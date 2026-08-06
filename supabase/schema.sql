-- Профиль пользователя (одна строка на пользователя; на старте — один пользователь, user_key захардкожен)
create table profile (
  id uuid primary key default gen_random_uuid(),
  user_key text unique not null default 'david',
  xp integer not null default 0,
  level integer not null default 1,
  streak integer not null default 0,
  last_active_date date,
  energy integer not null default 100,
  coins integer not null default 0,
  -- доп. поля под настройки напоминаний (раздел 2.5 ТЗ), в исходной схеме не были заданы отдельной таблицей
  move_interval_min integer not null default 60,
  sleep_reminder_hour integer not null default 23,
  last_movement_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Проекты
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_key text not null default 'david',
  name text not null,
  color text not null default '#3ff0ff',
  created_at timestamptz not null default now()
);

-- Задачи
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_key text not null default 'david',
  project_id uuid references projects(id) on delete set null,
  title text not null,
  priority text not null check (priority in ('high','mid','low')) default 'mid',
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Здоровье: сон
create table sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null default 'david',
  log_date date not null,
  hours numeric(4,1) not null,
  source text not null default 'manual', -- 'manual' | 'apple_health'
  created_at timestamptz not null default now(),
  unique (user_key, log_date, source)
);

-- Здоровье: подвижность / шаги / активность (универсальная таблица под разные метрики Apple Health)
create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_key text not null default 'david',
  log_date date not null,
  metric text not null,        -- 'steps' | 'movement_count' | 'active_minutes' | 'stand_hours' | 'resting_hr'
  value numeric not null,
  source text not null default 'manual', -- 'manual' | 'apple_health'
  created_at timestamptz not null default now()
);

-- Индексы для выборок по датам
create index idx_tasks_project on tasks(project_id);
create index idx_sleep_date on sleep_logs(log_date);
create index idx_activity_date_metric on activity_logs(log_date, metric);

-- Стартовые проекты (соответствуют предзаполненным в прототипе)
insert into profile (user_key) values ('david');
insert into projects (user_key, name, color) values
  ('david', 'БАЗА отдыха Романтик', '#3ff0ff'),
  ('david', 'ЦВН', '#ff3fb0'),
  ('david', 'SHAREVO', '#ffb92e');

-- Row Level Security (включить, даже с одним пользователем — задел на будущее)
alter table profile enable row level security;
alter table projects enable row level security;
alter table tasks enable row level security;
alter table sleep_logs enable row level security;
alter table activity_logs enable row level security;

-- Политика на старте: доступ через anon key только с правильным user_key (упрощённо, без полноценной авторизации)
-- В проде — заменить на auth.uid()-based политики при добавлении Supabase Auth
create policy "allow all for david" on profile for all using (true) with check (true);
create policy "allow all for david" on projects for all using (true) with check (true);
create policy "allow all for david" on tasks for all using (true) with check (true);
create policy "allow all for david" on sleep_logs for all using (true) with check (true);
create policy "allow all for david" on activity_logs for all using (true) with check (true);
