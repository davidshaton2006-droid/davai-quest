import { state } from './store.js';
import { updateProfile } from '../api/queries.js';
import { todayStr, showToast } from '../utils/helpers.js';

export function xpForLevel(lvl) {
  return lvl * 100;
}

export async function applyDailyTick() {
  const today = todayStr();
  const p = state.profile;
  if (p.last_active_date !== today) {
    const prevDate = p.last_active_date;
    let streak = p.streak;
    if (prevDate) {
      const diffDays = Math.round((new Date(today) - new Date(prevDate)) / 86400000);
      if (diffDays === 1) streak += 1;
      else if (diffDays > 1) streak = 0;
    }
    const energy = Math.min(100, p.energy + 20);
    Object.assign(p, await updateProfile({ last_active_date: today, streak, energy }));
  }
}

export async function addXP(amount) {
  const p = state.profile;
  let xp = p.xp + amount;
  let level = p.level;
  let coins = p.coins;
  let need = xpForLevel(level);
  let leveledUp = false;
  while (xp >= need) {
    xp -= need;
    level += 1;
    coins += 5;
    need = xpForLevel(level);
    leveledUp = true;
  }
  coins += Math.round(amount / 5);
  Object.assign(p, await updateProfile({ xp, level, coins }));
  if (leveledUp) {
    showToast('Новый уровень!', 'Уровень ' + p.level + ' достигнут. +5 кристаллов');
  }
}

export async function subtractXP(amount) {
  const p = state.profile;
  const xp = Math.max(0, p.xp - amount);
  Object.assign(p, await updateProfile({ xp }));
}

export async function adjustEnergy(delta) {
  const p = state.profile;
  const energy = Math.max(0, Math.min(100, p.energy + delta));
  Object.assign(p, await updateProfile({ energy }));
}

export function renderHud() {
  const p = state.profile;
  document.getElementById('lvlNum').textContent = p.level;
  const need = xpForLevel(p.level);
  document.getElementById('xpText').textContent = p.xp + ' / ' + need + ' XP';
  document.getElementById('xpFill').style.width = Math.min(100, (p.xp / need) * 100) + '%';
  document.getElementById('energyVal').textContent = p.energy;
  document.getElementById('energyRingVal').textContent = p.energy;
  document.getElementById('streakVal').textContent = p.streak;
  document.getElementById('coinsVal').textContent = p.coins;
  const circumference = 339;
  const offset = circumference * (1 - p.energy / 100);
  document.getElementById('energyCircle').style.strokeDashoffset = offset;
  const note = document.getElementById('energyNote');
  if (p.energy < 30) note.textContent = 'Энергия низкая. Хорошо бы поспать или сделать перерыв.';
  else if (p.energy < 60) note.textContent = 'Энергия средняя — можно поработать, но не забывай про отдых.';
  else note.textContent = 'Энергия в норме. Хорошее время для сложных задач.';
}
