import { supabase } from '../api/supabaseClient.js';

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

export function validatePassword(password) {
  return !!password && password.length >= 6;
}

function translateAuthError(err) {
  const msg = err?.message || '';
  if (/already registered/i.test(msg)) return 'Этот email уже зарегистрирован.';
  if (/invalid login credentials/i.test(msg)) return 'Неверный email или пароль.';
  if (/email not confirmed/i.test(msg)) return 'Email ещё не подтверждён — введи код из письма.';
  if (/token has expired|invalid otp|invalid token|token is invalid/i.test(msg)) return 'Код неверный или истёк — запроси новый.';
  if (/password.*at least/i.test(msg)) return 'Пароль — минимум 6 символов.';
  if (/failed to fetch/i.test(msg) || err?.name === 'TypeError') return 'Нет подключения к серверу — проверь сеть.';
  return msg || 'Что-то пошло не так.';
}

/* ---------- Регистрация ---------- */
export async function register(email, password) {
  if (!validateEmail(email)) throw new Error('Введи корректный email.');
  if (!validatePassword(password)) throw new Error('Пароль — минимум 6 символов.');
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new Error(translateAuthError(error));
  return data;
}

export async function verifySignup(email, code) {
  if (!code || !code.trim()) throw new Error('Введи код из письма.');
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'signup' });
  if (error) throw new Error(translateAuthError(error));
  return data;
}

export async function resendSignupCode(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  if (error) throw new Error(translateAuthError(error));
}

/* ---------- Вход ---------- */
export async function login(email, password) {
  if (!validateEmail(email)) throw new Error('Введи корректный email.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(translateAuthError(error));
  return data;
}

/* ---------- Восстановление пароля: код на email, затем новый пароль ---------- */
export async function requestPasswordReset(email) {
  if (!validateEmail(email)) throw new Error('Введи корректный email.');
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(translateAuthError(error));
}

export async function confirmPasswordReset(email, code, newPassword) {
  if (!code || !code.trim()) throw new Error('Введи код из письма.');
  if (!validatePassword(newPassword)) throw new Error('Пароль — минимум 6 символов.');
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: 'recovery'
  });
  if (verifyError) throw new Error(translateAuthError(verifyError));
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw new Error(translateAuthError(updateError));
}

/* ---------- Сессия ---------- */
export async function logout() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function getUsername(session) {
  return session?.user?.email?.split('@')[0] || 'Игрок';
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
