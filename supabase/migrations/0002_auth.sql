-- Переход от единственного захардкоженного пользователя 'david' к регистрации
-- по имени/паролю через Supabase Auth. Выполнить в SQL Editor ПОСЛЕ schema.sql.
--
-- ВАЖНО перед выполнением: в Authentication → Providers → Email выключить
-- "Confirm email" — приложение использует синтетические адреса вида
-- username@davaiquest.local, подтвердить их по почте невозможно, а без
-- отключения этой настройки Supabase не даст войти сразу после регистрации.

drop policy if exists "allow all for david" on profile;
drop policy if exists "allow all for david" on projects;
drop policy if exists "allow all for david" on tasks;
drop policy if exists "allow all for david" on sleep_logs;
drop policy if exists "allow all for david" on activity_logs;

-- Теперь user_key должен совпадать с auth.uid() (UID вошедшего пользователя),
-- а не быть произвольной строкой — доступ к чужим строкам закрыт на уровне БД.
create policy "owner access" on profile
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);
create policy "owner access" on projects
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);
create policy "owner access" on tasks
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);
create policy "owner access" on sleep_logs
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);
create policy "owner access" on activity_logs
  for all using (user_key = auth.uid()::text) with check (user_key = auth.uid()::text);

-- Старые тестовые записи с user_key = 'david' после этой миграции станут
-- никому не доступны (ни один auth.uid() не равен строке 'david') — это
-- ожидаемо. Если хочешь перенести их на свой новый аккаунт, зарегистрируйся
-- в приложении, возьми свой UID в Authentication → Users, и выполни:
--
-- update profile        set user_key = '<твой UID>' where user_key = 'david';
-- update projects       set user_key = '<твой UID>' where user_key = 'david';
-- update tasks          set user_key = '<твой UID>' where user_key = 'david';
-- update sleep_logs     set user_key = '<твой UID>' where user_key = 'david';
-- update activity_logs  set user_key = '<твой UID>' where user_key = 'david';
--
-- (профиль на этот момент уже будет создан приложением автоматически при
-- первом входе — тогда первую из строк выше нужно пропустить либо сначала
-- удалить автосозданный профиль нового пользователя).
