-- Привязка Telegram-аккаунта к пользователю DAVAI QUEST.
-- Выполнить в SQL Editor ПОСЛЕ schema.sql и 0002_auth.sql.

-- Одна строка на пользователя: его chat_id в Telegram + отметки, когда в
-- последний раз слали то или иное напоминание (чтобы не спамить чаще раза в день).
create table telegram_links (
  user_key text primary key,
  chat_id bigint not null unique,
  last_move_reminder_at date,
  last_energy_reminder_at date,
  last_sleep_reminder_at date,
  created_at timestamptz not null default now()
);

-- Одноразовые токены для привязки: приложение создаёт токен и открывает
-- t.me/<bot>?start=<token>, бот в /start находит токен и привязывает chat_id.
create table telegram_link_tokens (
  token text primary key,
  user_key text not null,
  created_at timestamptz not null default now(),
  used boolean not null default false
);

create index idx_telegram_tokens_user on telegram_link_tokens(user_key);

alter table telegram_links enable row level security;
alter table telegram_link_tokens enable row level security;

-- Владелец видит/создаёт только свои записи. Сами Edge Functions (webhook,
-- напоминания) работают через service_role и эти политики не затрагивают —
-- им нужен доступ к чужим chat_id по определению.
create policy "owner access" on telegram_links
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);
create policy "owner access" on telegram_link_tokens
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);
