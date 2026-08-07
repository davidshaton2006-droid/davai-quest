import { supabase } from '../api/supabaseClient.js';

// Supabase Auth работает поверх email/password; логин по имени пользователя
// эмулируем синтетическим адресом на несуществующем домене — сам email
// нигде не показывается и никуда не отправляется.
const EMAIL_DOMAIN = 'davaiquest.local';

function usernameToEmail(username) {
  return username.trim().toLowerCase().replace(/\s+/g, '') + '@' + EMAIL_DOMAIN;
}

export function validateCredentials(username, password) {
  const errors = [];
  const u = (username || '').trim();
  if (u.length < 3) errors.push('Имя пользователя — минимум 3 символа.');
  else if (!/^[a-zA-Z0-9_]+$/.test(u)) errors.push('Имя пользователя: только латинские буквы, цифры и «_».');
  if (!password || password.length < 6) errors.push('Пароль — минимум 6 символов.');
  return errors;
}

function translateAuthError(err) {
  const msg = err?.message || '';
  if (/already registered/i.test(msg)) return 'Это имя пользователя уже занято.';
  if (/invalid login credentials/i.test(msg)) return 'Неверное имя пользователя или пароль.';
  if (/password.*at least/i.test(msg)) return 'Пароль — минимум 6 символов.';
  if (/failed to fetch/i.test(msg) || err?.name === 'TypeError') return 'Нет подключения к серверу — проверь сеть.';
  return msg || 'Что-то пошло не так.';
}

export async function register(username, password) {
  const errors = validateCredentials(username, password);
  if (errors.length) throw new Error(errors.join(' '));
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: username.trim() } }
  });
  if (error) throw new Error(translateAuthError(error));
  return data;
}

export async function login(username, password) {
  const email = usernameToEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error));
  return data;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function getUsername(session) {
  return session?.user?.user_metadata?.username || session?.user?.email?.split('@')[0] || 'Игрок';
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
