import { supabase } from './supabaseClient.js';

const USER_KEY = 'david';

/* ---------- Профиль ---------- */
export async function getProfile() {
  const { data, error } = await supabase.from('profile').select('*').eq('user_key', USER_KEY).single();
  if (error) throw error;
  return data;
}
export async function updateProfile(patch) {
  const { data, error } = await supabase
    .from('profile')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_key', USER_KEY)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ---------- Проекты ---------- */
export async function getProjects() {
  const { data, error } = await supabase.from('projects').select('*').eq('user_key', USER_KEY).order('created_at');
  if (error) throw error;
  return data;
}
export async function createProject(name, color) {
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, color, user_key: USER_KEY })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ---------- Задачи ---------- */
export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_key', USER_KEY)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function createTask(task) {
  const { data, error } = await supabase.from('tasks').insert({ ...task, user_key: USER_KEY }).select().single();
  if (error) throw error;
  return data;
}
export async function toggleTask(id, done) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- Здоровье: чтение за период ---------- */
export async function getSleepLogs(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_key', USER_KEY)
    .gte('log_date', since)
    .order('log_date');
  if (error) throw error;
  return data;
}
export async function getActivityLogs(metric, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_key', USER_KEY)
    .eq('metric', metric)
    .gte('log_date', since)
    .order('log_date');
  if (error) throw error;
  return data;
}

/* ---------- Здоровье: ручная запись (форма в UI и внешний вызов из Shortcuts) ---------- */
export async function logSleep(hours, date = new Date().toISOString().slice(0, 10), source = 'manual') {
  const { data, error } = await supabase
    .from('sleep_logs')
    .upsert({ user_key: USER_KEY, log_date: date, hours, source }, { onConflict: 'user_key,log_date,source' })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function logActivity(metric, value, date = new Date().toISOString().slice(0, 10), source = 'manual') {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert({ user_key: USER_KEY, log_date: date, metric, value, source })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function getLastMovement() {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('created_at')
    .eq('user_key', USER_KEY)
    .eq('metric', 'movement_count')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? data.created_at : null;
}
