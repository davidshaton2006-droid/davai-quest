import { state } from './store.js';
import { showToast } from '../utils/helpers.js';
import { renderHealth } from './health.js';

export function renderReminders() {
  const msgs = [];
  const p = state.profile;
  const mins = state.health.lastMovementAt
    ? Math.round((Date.now() - new Date(state.health.lastMovementAt).getTime()) / 60000)
    : null;

  if (mins !== null && mins >= p.move_interval_min) {
    msgs.push('Прошло ' + mins + ' мин без движения — время размяться.');
  }
  const hour = new Date().getHours();
  if (hour >= p.sleep_reminder_hour || hour < 5) {
    msgs.push('Уже поздно — не забудь лечь спать вовремя.');
  }
  if (p.energy < 25) {
    msgs.push('Энергия критически низкая. Сделай паузу.');
  }
  const activeCount = state.tasks.filter((t) => !t.done).length;
  if (activeCount === 0) {
    msgs.push('Все задачи выполнены — можно спланировать следующий проект.');
  } else if (activeCount > 8) {
    msgs.push('Накопилось много задач (' + activeCount + '). Возможно, стоит расставить приоритеты.');
  }

  const el = document.getElementById('reminderBody');
  el.innerHTML = msgs.length
    ? msgs
        .map(
          (m) =>
            '<div style="margin-bottom:8px;padding:8px 10px;border-radius:9px;background:rgba(255,185,46,0.06);border:1px solid rgba(255,185,46,0.25);color:#ffd68a;font-size:12px;">' +
            m +
            '</div>'
        )
        .join('')
    : '<span style="color:var(--text-faint);">Всё под контролем. Напоминаний нет.</span>';
}

let reminderInterval = null;
export function startReminderLoop() {
  renderReminders();
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(() => {
    renderReminders();
    renderHealth();
    const p = state.profile;
    const mins = state.health.lastMovementAt
      ? Math.round((Date.now() - new Date(state.health.lastMovementAt).getTime()) / 60000)
      : null;
    if (mins === p.move_interval_min) {
      showToast('Пора размяться', 'Ты сидишь уже ' + mins + ' минут подряд.');
    }
  }, 60000);
}
