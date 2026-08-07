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
3. **Authentication → Providers → Email → выключить «Confirm email»**. Приложение регистрирует
   пользователей по имени, а не по e-mail (см. ниже) — синтетический адрес подтвердить письмом
   невозможно, без этой настройки вход после регистрации не пройдёт.
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
- Тело: `{"email":"<имя_пользователя>@davaiquest.local","password":"<пароль>"}`
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

### 6. Telegram-интеграция — тоже пока не сделано

Договорились обсудить отдельно, когда дойдём до этого шага.

## Регистрация и вход

При первом открытии приложения показывается экран входа/регистрации — имя пользователя
(латиница/цифры/`_`, от 3 символов) и пароль (от 6 символов). Технически это Supabase Auth:
логин конвертируется в синтетический e-mail `<имя>@davaiquest.local` и используется обычная
пара email+password — пользователь этого не видит. У каждого аккаунта свои задачи, проекты и
данные здоровья — на уровне БД это гарантируют RLS-политики на `auth.uid()`
([`supabase/migrations/0002_auth.sql`](supabase/migrations/0002_auth.sql)).

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
│   │   ├── auth.js          регистрация/вход/выход
│   │   ├── offline.js       localStorage-кэш + guardOffline для мутаций
│   │   ├── profile.js       XP, уровень, энергия, стрик
│   │   ├── tasks.js
│   │   ├── projects.js
│   │   ├── health.js        + analyzeHealth() — сводка по трендам
│   │   └── reminders.js
│   ├── styles/main.css
│   └── utils/helpers.js
├── public/
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   └── sw.js                офлайн-кэш статики приложения
└── supabase/
    ├── schema.sql
    └── migrations/0002_auth.sql
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
