# DAVAI QUEST

Персональный игровой ассистент для управления задачами, проектами и здоровьем.

## Стек

Vite (vanilla JS) + Supabase (Postgres, REST API) + Google Fonts (Orbitron, Rajdhani).

## Локальный запуск

```bash
npm install
cp .env.example .env
# заполнить .env значениями из Supabase (см. ниже)
npm run dev
```

## Деплой: пошагово

### 1. Supabase

1. Создать проект на [supabase.com](https://supabase.com).
2. Открыть **SQL Editor** → по очереди выполнить:
   - [`supabase/schema.sql`](supabase/schema.sql) — таблицы `profile`, `projects`, `tasks`,
     `sleep_logs`, `activity_logs` + временная политика `using (true)` и тестовые данные
     для `user_key = 'david'`.
   - [`supabase/migrations/0002_auth.sql`](supabase/migrations/0002_auth.sql) — переключает
     политики на `auth.uid()`, чтобы у каждого зарегистрированного пользователя был доступ
     только к своим данным.
3. **Authentication → Providers → Email**: «Confirm email» должен быть **включён** (это и есть
   значение по умолчанию для нового проекта — можно ничего не трогать). Дальше:
   **Authentication → Email Templates → Confirm signup** — добавь в текст письма `{{ .Token }}`,
   чтобы оно показывало 6-значный код, а не только ссылку (код нужен для экрана подтверждения
   в приложении). То же самое — в шаблоне **Reset Password**, он используется для восстановления
   пароля.
4. В **Project Settings → API** скопировать `Project URL` и `anon public` (он же теперь
   называется **Publishable key**) в `.env`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

### 2. GitHub

```bash
git init
git add .
git commit -m "init"
git remote add origin <URL твоего репозитория davai-quest>
git push -u origin main
```

### 3. Хостинг — GitHub Pages

Публикация настроена через GitHub Actions ([`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)):
при каждом пуше в `main` он собирает проект (`npm run build`) и выкладывает `dist/` на Pages.

1. В репозитории на GitHub: **Settings → Pages → Build and deployment → Source** — выбрать
   **GitHub Actions**.
2. Там же: **Settings → Secrets and variables → Actions → New repository secret** — добавить
   вручную (не вставляй их мне в чат, это ключи доступа к базе):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (значения — из Supabase **Project Settings → API**, те же, что в `.env`).
3. Запушить в `main` (или запустить workflow вручную — вкладка **Actions** → Deploy to
   GitHub Pages → Run workflow). После первого успешного запуска сайт будет доступен на
   `https://<твой-логин>.github.io/davai-quest/`.

`vite.config.js` уже настроен на `base: '/davai-quest/'` при сборке (нужно для корректных путей
на GitHub Pages) — при переименовании репозитория это значение нужно поменять там же.

### 4. Домен (опционально)

В репозитории **Settings → Pages → Custom domain** — вписать свой домен, прописать у
регистратора CNAME-запись на `<твой-логин>.github.io` по инструкции GitHub.

### 5. Автосбор данных из Apple Health (Shortcuts) — ещё не настроено, план

Приложение "Здоровье" на iPhone не отдаёт данные напрямую — их будет выгружать **Shortcuts**
через HTTP-запрос к Supabase REST API. **Важно:** после перехода на авторизацию (раздел
«Регистрация» ниже) политики RLS требуют `auth.uid()` — простой POST с одним `anon`-ключом
без входа в аккаунт база больше не примет (`auth.uid()` у анонимного запроса пустой). Поэтому
автоматизация должна сначала получить токен пользователя, и только потом писать данные:

**Шаг 0 — получить токен** (в начале каждой автоматизации):
- URL: `https://<project-ref>.supabase.co/auth/v1/token?grant_type=password`
- Метод: `POST`
- Заголовки: `apikey: <ANON_KEY>`, `Content-Type: application/json`
- Тело: `{"email":"<твой email в приложении>","password":"<пароль>"}`
- Из ответа взять поле `access_token` (действие «Получить значение словаря»).

**Automation 1 — сон** (триггер по времени, например 8:00):
1. Шаг 0 → получить `access_token`.
2. "Найти данные о здоровье" → категория "Сон", период "Последняя ночь".
3. "Получить содержимое URL":
   - URL: `https://<project-ref>.supabase.co/rest/v1/sleep_logs`
   - Метод: `POST`
   - Заголовки: `apikey: <ANON_KEY>`, `Authorization: Bearer <access_token из шага 0>`,
     `Content-Type: application/json`, `Prefer: resolution=merge-duplicates`
   - Тело: `{"user_key":"<UID пользователя>","log_date":"ГГГГ-ММ-ДД","hours":ЧАСЫ,"source":"apple_health"}`
     (UID — из Supabase **Authentication → Users**, не имя пользователя)

**Automation 2 — активность** (шаги / активные минуты / часы стойки / пульс в покое):
То же самое, но:
   - URL: `https://<project-ref>.supabase.co/rest/v1/activity_logs`
   - Тело: `{"user_key":"<UID пользователя>","log_date":"ГГГГ-ММ-ДД","metric":"steps","value":ЗНАЧЕНИЕ,"source":"apple_health"}`
     (`metric` → `steps` | `active_minutes` | `stand_hours` | `resting_hr`)

В настройках автоматизации выключить "Спрашивать перед запуском". `access_token` живёт около
часа — для автоматизаций по расписанию его нужно получать заново при каждом запуске (шаг 0),
хранить не нужно.

**Важно про ключи:** `anon`/Publishable ключ безопасен внутри Shortcuts только в паре с
токеном пользователя из шага 0. Ключ `service_role`/Secret нигде не используется — он обходит
RLS и даёт полный доступ к чужим данным при утечке.

### 6. Telegram-интеграция

Бот умеет две вещи: присылает напоминания (энергия, разминка, поздний час) и принимает
записи текстом («сон 7», «размялся»). Реализовано двумя Supabase Edge Functions —
[`telegram-webhook`](supabase/functions/telegram-webhook/index.ts) (приём сообщений) и
[`telegram-reminders`](supabase/functions/telegram-reminders/index.ts) (рассылка по расписанию).

**6.1 — таблицы.** В SQL Editor выполнить [`supabase/migrations/0003_telegram.sql`](supabase/migrations/0003_telegram.sql)
(после `schema.sql` и `0002_auth.sql`).

**6.2 — создать бота.** В Telegram написать [@BotFather](https://t.me/BotFather) →
`/newbot` → задать имя и username (например `davai_quest_bot`) → сохранить выданный
**токен бота**.

**6.3 — Supabase CLI.** Глобально через `npm install -g supabase` он больше не ставится
(Supabase это специально запретили) — проще всего просто вызывать его через `npx`, без
установки: каждая команда ниже начинается с `npx supabase` вместо `supabase`. Выполнять из
папки проекта (`cd davai-quest`):
```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # project-ref — из Project URL: https://<project-ref>.supabase.co
```
`login` откроет браузер — подтверди вход в свой аккаунт Supabase там же, где обычно заходишь
в дашборд. Если хочешь, чтобы дальше не писать `npx` перед каждой командой — на Windows можно
поставить через [Scoop](https://scoop.sh): `scoop bucket add supabase https://github.com/supabase/scoop-bucket.git`
затем `scoop install supabase`, и дальше просто `supabase ...` без `npx`.

**6.4 — задать секреты функций.** Придумать свою случайную строку для `TELEGRAM_WEBHOOK_SECRET`
и `CRON_SECRET` (любые длинные случайные строки, например из `openssl rand -hex 20`).
`SERVICE_ROLE_KEY` — из Supabase **Project Settings → API Keys → Secret key** (это не тот
ключ, что в `.env` фронтенда — не путать, этот боевой, обходит RLS, идёт только в секреты
функций, никогда во фронтенд и никогда в GitHub Actions):
```bash
npx supabase secrets set TELEGRAM_BOT_TOKEN=<токен от BotFather>
npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=<своя случайная строка>
npx supabase secrets set CRON_SECRET=<другая своя случайная строка>
npx supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<Secret key из Project Settings → API Keys>
```

**6.5 — задеплоить функции:**
```bash
npx supabase functions deploy telegram-webhook --no-verify-jwt
npx supabase functions deploy telegram-reminders --no-verify-jwt
```

**6.6 — зарегистрировать вебхук у Telegram** (один раз, вызвать откуда угодно — например
через `curl` в терминале):
```bash
curl "https://api.telegram.org/bot<токен от BotFather>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<project-ref>.functions.supabase.co/telegram-webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET из 6.4>"}'
```

**6.7 — расписание напоминаний.** В SQL Editor (один раз):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'telegram-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.functions.supabase.co/telegram-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET из 6.4>'),
    body := '{}'::jsonb
  );
  $$
);
```

**6.8 — подключить фронтенд.** Добавить username бота (без `@`) в `.env` и в GitHub-секрет:
```
VITE_TELEGRAM_BOT_USERNAME=davai_quest_bot
```
(в GitHub — тем же способом, что `VITE_SUPABASE_*`, раздел «3. Хостинг» выше; после
добавления секрета пересобрать через Actions → Run workflow).

После этого в приложении на вкладке **Здоровье** появится рабочая кнопка «Подключить
Telegram» — она открывает чат с ботом, `/start` внутри чата довершает привязку аккаунта.
В чате дальше работают команды `сон 7`, `размялся`, `/help`.

## Регистрация и вход

При первом открытии приложения — экран входа/регистрации, обычный Supabase Auth на email и
пароле (от 6 символов):

- **Регистрация** → на почту приходит письмо с 6-значным кодом → экран подтверждения кода
  (`supabase.auth.verifyOtp(..., type: 'signup')`) → сразу вход в приложение.
- **Вход** → просто email + пароль.
- **«Забыл пароль?»** → на почту приходит код сброса → экран «код + новый пароль»
  (`verifyOtp(..., type: 'recovery')`, затем `updateUser({ password })`).

У каждого аккаунта свои задачи, проекты и данные здоровья — на уровне БД это гарантируют
RLS-политики на `auth.uid()` ([`supabase/migrations/0002_auth.sql`](supabase/migrations/0002_auth.sql)).
Без настройки шаблонов писем с `{{ .Token }}` (см. раздел «1. Supabase» выше) в письме будет
только ссылка без кода, и экран подтверждения кода работать не сможет.

## Офлайн-доступ

- После каждой успешной загрузки данные (профиль, проекты, задачи, здоровье) сохраняются в
  `localStorage` устройства ([`src/modules/offline.js`](src/modules/offline.js)).
- Если при следующем запуске сети нет — приложение открывается с последним сохранённым
  состоянием и показывает баннер «Офлайн-режим». Сессия входа тоже хранится локально
  (это делает сам Supabase SDK), так что повторно логиниться офлайн не нужно.
- Изменения (новая задача, отметка выполнения, запись сна и т.д.), сделанные офлайн, **не
  сохраняются** — появляется тост «Нет сети», действие нужно повторить при восстановлении
  соединения. Полноценной очереди отложенной синхронизации пока нет.
- `public/sw.js` — service worker, кэширующий HTML/CSS/JS самого приложения, чтобы оно
  открывалось офлайн даже с пустым кэшем браузера (не только с уже посещённой вкладки).

## Telegram

- **Привязка**: кнопка в приложении создаёт одноразовый токен → открывает
  `t.me/<бот>?start=<токен>` → `/start` в чате находит токен и связывает `chat_id` с
  аккаунтом (таблица `telegram_links`).
- **Запись через бота**: сообщения «сон 7» / «размялся» пишут в те же таблицы
  (`sleep_logs`/`activity_logs`) и начисляют тот же XP/энергию, что и форма в приложении —
  логика продублирована в `telegram-webhook`, так как Edge Function не может импортировать
  код фронтенда.
- **Напоминания**: `telegram-reminders` раз в 15 минут (расписание `pg_cron`) проверяет тех же
  трёх условий, что и внутриигровые напоминания (низкая энергия / давно не двигался / поздний
  час), и шлёт сообщение не чаще раза в день на каждое условие.
- Обе функции работают через `service_role`-ключ (обходит RLS) — это единственное место в
  проекте, где этот ключ используется, и он никогда не попадает во фронтенд.

## Структура проекта

```
davai-quest/
├── index.html
├── src/
│   ├── main.js              точка входа, гейт авторизации
│   ├── api/
│   │   ├── supabaseClient.js
│   │   └── queries.js       все запросы к Supabase (user_key = auth.uid())
│   ├── modules/
│   │   ├── store.js         общий кэш состояния в памяти
│   │   ├── auth.js          регистрация/вход/подтверждение кодом/сброс пароля
│   │   ├── offline.js       localStorage-кэш + guardOffline для мутаций
│   │   ├── profile.js       XP, уровень, энергия, стрик
│   │   ├── tasks.js
│   │   ├── projects.js
│   │   ├── health.js        + analyzeHealth() — сводка по трендам
│   │   ├── reminders.js
│   │   └── telegram.js      привязка аккаунта к боту
│   ├── styles/main.css
│   └── utils/helpers.js
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   └── sw.js                офлайн-кэш статики приложения
└── supabase/
    ├── schema.sql
    ├── migrations/
    │   ├── 0002_auth.sql
    │   └── 0003_telegram.sql
    └── functions/
        ├── telegram-webhook/index.ts     приём сообщений бота
        └── telegram-reminders/index.ts   напоминания по расписанию
```

## Примечания

- Схема БД расширена тремя полями в `profile` (`move_interval_min`, `sleep_reminder_hour`,
  `last_movement_at`) — в исходном ТЗ настройки напоминаний не были привязаны ни к одной таблице,
  логичнее всего хранить их там же, где остальное состояние профиля.
- `user_key` во всех таблицах теперь хранит UID из Supabase Auth (`auth.uid()::text`), а не
  строку `'david'` — так исторически называлось поле, менять имя колонки не стали, чтобы не
  переписывать всю схему.
- Строки с `user_key = 'david'` из первого запуска `schema.sql` остаются в базе, но никому не
  принадлежат после `0002_auth.sql` (ни один `auth.uid()` не равен строке `'david'`) — их можно
  перенести на свой аккаунт вручную, см. комментарий в конце `0002_auth.sql`.
- `manifest.webmanifest` + `sw.js` дают возможность добавить сайт на экран iPhone как PWA и
  открывать офлайн.
