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
2. Открыть **SQL Editor** → выполнить содержимое [`supabase/schema.sql`](supabase/schema.sql).
   Скрипт создаёт таблицы `profile`, `projects`, `tasks`, `sleep_logs`, `activity_logs`,
   включает RLS с политикой `using (true)` (упрощение для одного пользователя) и сразу
   заводит профиль `david` и три стартовых проекта.
3. В **Project Settings → API** скопировать `Project URL` и `anon public` ключ в `.env`:
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

### 3. Хостинг (Vercel)

1. Импортировать репозиторий в [vercel.com](https://vercel.com) (framework preset — Vite).
2. В **Settings → Environment Variables** добавить `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`
   (те же значения, что в `.env`, не коммитить сам `.env`).
3. Deploy.

### 4. Домен

В настройках проекта на Vercel → **Domains** → добавить свой домен, прописать у регистратора
CNAME/A-записи по инструкции, которую покажет Vercel.

### 5. Автосбор данных из Apple Health (Shortcuts)

Приложение "Здоровье" на iPhone не отдаёт данные напрямую — их выгружает **Shortcuts** через
обычный HTTP-запрос к Supabase REST API (создаётся автоматически для каждой таблицы).

**Automation 1 — сон** (триггер по времени, например 8:00):
1. "Найти данные о здоровье" → категория "Сон", период "Последняя ночь".
2. "Получить содержимое URL":
   - URL: `https://<project-ref>.supabase.co/rest/v1/sleep_logs`
   - Метод: `POST`
   - Заголовки: `apikey: <ANON_KEY>`, `Authorization: Bearer <ANON_KEY>`,
     `Content-Type: application/json`, `Prefer: resolution=merge-duplicates`
   - Тело: `{"user_key":"david","log_date":"ГГГГ-ММ-ДД","hours":ЧАСЫ,"source":"apple_health"}`

**Automation 2 — активность** (шаги / активные минуты / часы стойки / пульс в покое):
То же самое, но:
   - URL: `https://<project-ref>.supabase.co/rest/v1/activity_logs`
   - Тело: `{"user_key":"david","log_date":"ГГГГ-ММ-ДД","metric":"steps","value":ЗНАЧЕНИЕ,"source":"apple_health"}`
     (`metric` → `steps` | `active_minutes` | `stand_hours` | `resting_hr`)

В настройках автоматизации выключить "Спрашивать перед запуском".

**Важно про ключ:** используется только `anon` ключ (безопасен при включённых RLS-политиках
из `schema.sql`). Ключ `service_role` нигде не используется — он обходит RLS.

## Структура проекта

```
davai-quest/
├── index.html
├── src/
│   ├── main.js              точка входа
│   ├── api/
│   │   ├── supabaseClient.js
│   │   └── queries.js       все запросы к Supabase
│   ├── modules/
│   │   ├── store.js         общий кэш состояния в памяти
│   │   ├── profile.js       XP, уровень, энергия, стрик
│   │   ├── tasks.js
│   │   ├── projects.js
│   │   ├── health.js        + analyzeHealth() — сводка по трендам
│   │   └── reminders.js
│   ├── styles/main.css
│   └── utils/helpers.js
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest
└── supabase/schema.sql
```

## Примечания

- Схема БД расширена тремя полями в `profile` (`move_interval_min`, `sleep_reminder_hour`,
  `last_movement_at`) — в исходном ТЗ настройки напоминаний не были привязаны ни к одной таблице,
  логичнее всего хранить их там же, где остальное состояние профиля.
- Пока пользователь один (`user_key = 'david'`), поэтому политики RLS — `using (true)`.
  При добавлении Supabase Auth и второго пользователя нужно переписать их на `auth.uid()`.
- `manifest.webmanifest` даёт возможность добавить сайт на экран iPhone как PWA.
