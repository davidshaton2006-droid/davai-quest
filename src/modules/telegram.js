import { state } from './store.js';
import * as queries from '../api/queries.js';
import { showToast } from '../utils/helpers.js';
import { guardOffline } from './offline.js';

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

export async function loadTelegramStatus() {
  state.telegram = await queries.getTelegramLink();
}

export function renderTelegram() {
  const el = document.getElementById('telegramPanel');
  if (!el) return;

  if (!BOT_USERNAME) {
    el.innerHTML = '<p class="small-note">Telegram-бот ещё не настроен (не задан VITE_TELEGRAM_BOT_USERNAME).</p>';
    return;
  }

  if (state.telegram) {
    el.innerHTML =
      '<p class="section-sub">Telegram подключён ✓ — напоминания и команды «сон 7» / «размялся» работают в чате.</p>' +
      '<button type="button" class="btn ghost small" id="tgDisconnectBtn">Отключить</button>';
    document.getElementById('tgDisconnectBtn').addEventListener('click', disconnectTelegram);
  } else {
    el.innerHTML =
      '<p class="section-sub">Получай напоминания и записывай сон/разминку прямо в Telegram.</p>' +
      '<button type="button" class="btn" id="tgConnectBtn">Подключить Telegram</button>';
    document.getElementById('tgConnectBtn').addEventListener('click', connectTelegram);
  }
}

async function connectTelegram() {
  const token = await guardOffline(
    () => queries.createTelegramLinkToken(),
    () => showToast('Нет сети', 'Не удалось создать ссылку — работаем офлайн.')
  );
  if (!token) return;
  window.open(`https://t.me/${BOT_USERNAME}?start=${token}`, '_blank');
  showToast('Открой Telegram', 'Нажми Start в открывшемся чате, чтобы завершить привязку.');
}

async function disconnectTelegram() {
  const ok = await guardOffline(
    async () => {
      await queries.disconnectTelegram();
      return true;
    },
    () => showToast('Нет сети', 'Не удалось отключить — работаем офлайн.')
  );
  if (!ok) return;
  state.telegram = null;
  renderTelegram();
  showToast('Telegram отключён', 'Напоминания и запись через бота больше не работают.');
}
