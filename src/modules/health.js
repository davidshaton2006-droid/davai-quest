import { state } from './store.js';
import * as queries from '../api/queries.js';
import { todayStr, last7Dates, showToast } from '../utils/helpers.js';
import { addXP, adjustEnergy } from './profile.js';

/* ---------- Загрузка ---------- */
export async function loadHealth() {
  const [sleepRows, movementRows, lastMovementAt] = await Promise.all([
    queries.getSleepLogs(30),
    queries.getActivityLogs('movement_count', 30),
    queries.getLastMovement()
  ]);
  state.health.sleep = sleepRows.map((r) => ({ date: r.log_date, hours: Number(r.hours) }));
  state.health.movement = aggregateByDate(movementRows);
  state.health.lastMovementAt = lastMovementAt;
}

function aggregateByDate(rows) {
  const byDate = new Map();
  for (const r of rows) {
    byDate.set(r.log_date, (byDate.get(r.log_date) || 0) + Number(r.value));
  }
  return [...byDate.entries()].map(([date, count]) => ({ date, count }));
}

/* ---------- Запись ---------- */
export async function logSleepEntry() {
  const input = document.getElementById('sleepHours');
  const val = parseFloat(input.value);
  if (isNaN(val) || val < 0) return;
  const today = todayStr();

  await queries.logSleep(val, today);
  const existing = state.health.sleep.find((s) => s.date === today);
  if (existing) existing.hours = val;
  else state.health.sleep.push({ date: today, hours: val });

  input.value = '';
  const xp = val >= 7 ? 10 : 5;
  await addXP(xp);
  await adjustEnergy(val >= 7 ? 15 : 5);
  showToast('Сон записан', val + ' ч сна · +' + xp + ' XP');
  renderHealth();
}

export async function logMovementEntry() {
  const today = todayStr();
  await queries.logActivity('movement_count', 1, today);
  const existing = state.health.movement.find((m) => m.date === today);
  if (existing) existing.count += 1;
  else state.health.movement.push({ date: today, count: 1 });
  state.health.lastMovementAt = new Date().toISOString();

  await addXP(5);
  await adjustEnergy(6);
  showToast('Разминка засчитана', '+5 XP · энергия +6');
  renderHealth();
}

export async function saveIntervals() {
  const mv = parseInt(document.getElementById('moveIntervalInput').value);
  const sr = parseInt(document.getElementById('sleepReminderInput').value);
  const patch = {};
  if (!isNaN(mv) && mv >= 5) patch.move_interval_min = mv;
  if (!isNaN(sr) && sr >= 0 && sr <= 23) patch.sleep_reminder_hour = sr;
  if (Object.keys(patch).length) {
    Object.assign(state.profile, await queries.updateProfile(patch));
  }
  showToast('Настройки сохранены', 'Интервалы напоминаний обновлены');
}

/* ---------- Рендер ---------- */
function renderMiniBars(containerId, data, key, goodThreshold) {
  const days = last7Dates();
  const el = document.getElementById(containerId);
  const max = key === 'hours' ? 10 : 4;
  el.innerHTML = days
    .map((d) => {
      const rec = data.find((x) => x.date === d);
      const v = rec ? rec[key] : 0;
      const h = Math.max(4, Math.min(70, (v / max) * 70));
      const low = key === 'hours' && v > 0 && v < goodThreshold;
      const label = d.slice(5).replace('-', '/');
      return '<div class="mini-bar-wrap"><div class="mini-bar ' + (low ? 'low' : '') + '" style="height:' + h + 'px" title="' + v + '"></div><span>' + label + '</span></div>';
    })
    .join('');
}

export function renderHealth() {
  renderMiniBars('sleepChart', state.health.sleep, 'hours', 7);
  renderMiniBars('moveChart', state.health.movement, 'count', 0);
  const mins = state.health.lastMovementAt
    ? Math.round((Date.now() - new Date(state.health.lastMovementAt).getTime()) / 60000)
    : null;
  document.getElementById('lastMoveText').textContent = mins === null ? '—' : mins < 1 ? 'только что' : mins + ' мин назад';
  document.getElementById('moveIntervalInput').value = state.profile.move_interval_min;
  document.getElementById('sleepReminderInput').value = state.profile.sleep_reminder_hour;
  renderHealthSummary();
}

/* ---------- Сводка по здоровью (раздел 2.4 ТЗ): анализ трендов, не разовых значений ---------- */
export function analyzeHealth(sleepLogs, movementLogs) {
  const days = last7Dates();
  const sleepByDate = new Map(sleepLogs.map((s) => [s.date, s.hours]));
  const moveByDate = new Map(movementLogs.map((m) => [m.date, m.count]));

  const sleepDaysLogged = days.filter((d) => sleepByDate.has(d));
  const goodSleepDays = days.filter((d) => (sleepByDate.get(d) || 0) >= 7).length;
  const activeDays = days.filter((d) => (moveByDate.get(d) || 0) > 0).length;

  const longestSleepGap = longestGap(days, (d) => (sleepByDate.get(d) || 0) < 7);
  const longestMoveGap = longestGap(days, (d) => !(moveByDate.get(d) > 0));

  const items = [];

  if (longestSleepGap >= 3) {
    items.push({ zone: 'red', title: 'Критично', text: 'Недосып ' + longestSleepGap + ' дня подряд (меньше 7ч). Постарайся лечь сегодня пораньше.' });
  } else if (longestSleepGap === 2) {
    items.push({ zone: 'yellow', title: 'Внимание', text: 'Два дня подряд недосыпа. Ещё один такой день — и это станет тенденцией.' });
  } else if (goodSleepDays >= 5) {
    items.push({ zone: 'green', title: 'В норме', text: 'Стабильный сон 7+ часов ' + goodSleepDays + '/7 дней.' });
  }

  if (longestMoveGap >= 3) {
    items.push({ zone: 'red', title: 'Критично', text: 'Нет движения уже ' + longestMoveGap + ' дня подряд. Организму нужна активность.' });
  } else if (activeDays <= 3) {
    items.push({ zone: 'yellow', title: 'Внимание', text: 'Активность нерегулярная — только ' + activeDays + '/7 дней с разминками.' });
  } else if (activeDays >= 5) {
    items.push({ zone: 'green', title: 'В норме', text: 'Разминки зафиксированы ' + activeDays + '/7 дней.' });
  }

  if (sleepDaysLogged.length < 3) {
    items.push({ zone: 'yellow', title: 'Мало данных', text: 'Сон записан только ' + sleepDaysLogged.length + '/7 дней — сводка станет точнее по мере накопления данных.' });
  }

  if (!items.length) {
    items.push({ zone: 'green', title: 'В норме', text: 'Данных пока немного, но критичных отклонений не видно.' });
  }

  return items;
}

function longestGap(days, isBad) {
  let longest = 0;
  let current = 0;
  for (const d of days) {
    if (isBad(d)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

function renderHealthSummary() {
  const el = document.getElementById('healthSummary');
  if (!el) return;
  const items = analyzeHealth(state.health.sleep, state.health.movement);
  el.innerHTML = items
    .map((it) => '<div class="hs-item hs-' + it.zone + '"><b>' + it.title + '</b>' + it.text + '</div>')
    .join('');
}
