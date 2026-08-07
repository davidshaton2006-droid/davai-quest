import { state } from './store.js';
import * as queries from '../api/queries.js';
import { escapeHtml, showToast } from '../utils/helpers.js';
import { guardOffline } from './offline.js';
import { addXP, subtractXP, adjustEnergy, renderHud } from './profile.js';
import { renderProjects } from './projects.js';

const XP_BY_PRIORITY = { high: 20, mid: 12, low: 6 };
const notifyOffline = () => showToast('Нет сети', 'Изменение не сохранено — работаем офлайн.');

export async function addTask(mode) {
  const titleEl = mode === 'qa' ? document.getElementById('qaTitle') : document.getElementById('taskTitle');
  const projEl = mode === 'qa' ? document.getElementById('qaProject') : document.getElementById('taskProject');
  const prioEl = mode === 'qa' ? document.getElementById('qaPriority') : document.getElementById('taskPriority');
  const dueEl = mode === 'full' ? document.getElementById('taskDue') : null;
  const title = titleEl.value.trim();
  if (!title) return;

  const created = await guardOffline(
    () =>
      queries.createTask({
        title,
        project_id: projEl.value || null,
        priority: prioEl.value,
        due_date: dueEl && dueEl.value ? dueEl.value : null,
        done: false
      }),
    notifyOffline
  );
  if (!created) return;
  state.tasks.unshift(created);

  titleEl.value = '';
  if (dueEl) dueEl.value = '';
  renderTasks();
  renderDashTasks();
  renderProjects();
}

export async function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  const done = !t.done;
  const xp = XP_BY_PRIORITY[t.priority];

  const updated = await guardOffline(() => queries.toggleTask(id, done), notifyOffline);
  if (!updated) return;
  Object.assign(t, updated);

  if (done) {
    await addXP(xp);
    await adjustEnergy(-4);
    showToast('Задача выполнена', '+' + xp + ' XP · ' + taskProjectName(t));
  } else {
    await subtractXP(xp);
  }

  renderTasks();
  renderDashTasks();
  renderProjects();
  renderHud();
}

export async function deleteTask(id) {
  const result = await guardOffline(async () => {
    await queries.deleteTask(id);
    return true;
  }, notifyOffline);
  if (!result) return;
  state.tasks = state.tasks.filter((x) => x.id !== id);
  renderTasks();
  renderDashTasks();
  renderProjects();
}

function taskProjectName(t) {
  const p = state.projects.find((p) => p.id === t.project_id);
  return p ? p.name : 'Без проекта';
}
function taskProjectColor(t) {
  const p = state.projects.find((p) => p.id === t.project_id);
  return p ? p.color : '#888';
}

function taskRowHtml(t) {
  const prioClass = t.priority === 'high' ? 'prio-high' : t.priority === 'mid' ? 'prio-mid' : 'prio-low';
  const prioLabel = t.priority === 'high' ? 'Высокий' : t.priority === 'mid' ? 'Средний' : 'Низкий';
  const dueHtml = t.due_date ? '<span class="t-due">до ' + t.due_date + '</span>' : '';
  return (
    '<div class="task ' + (t.done ? 'done' : '') + '">' +
    '<button class="chk" data-toggle="' + t.id + '">' + (t.done ? '✓' : '') + '</button>' +
    '<div class="t-body"><div class="t-title">' + escapeHtml(t.title) + '</div>' +
    '<div class="t-meta"><span class="tag proj" style="border-color:' + taskProjectColor(t) + '55;color:' + taskProjectColor(t) + '">' + escapeHtml(taskProjectName(t)) + '</span>' +
    '<span class="tag ' + prioClass + '">' + prioLabel + '</span>' + dueHtml + '</div></div>' +
    '<div class="t-actions"><button class="icon-btn" data-delete="' + t.id + '" title="Удалить">✕</button></div>' +
    '</div>'
  );
}

function bindTaskActions(container) {
  container.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => toggleTask(btn.dataset.toggle));
  });
  container.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.delete));
  });
}

export function renderDashTasks() {
  const list = state.tasks.filter((t) => !t.done).slice(0, 8);
  const el = document.getElementById('dashTaskList');
  el.innerHTML = list.length
    ? list.map(taskRowHtml).join('')
    : '<div class="empty">Нет активных задач. Самое время добавить квест.</div>';
  bindTaskActions(el);
}

export function renderTasks() {
  const filterProj = document.getElementById('filterProject').value;
  const filterStatus = document.getElementById('filterStatus').value;
  let list = state.tasks.slice();
  if (filterProj !== 'all') list = list.filter((t) => t.project_id === filterProj);
  if (filterStatus === 'active') list = list.filter((t) => !t.done);
  if (filterStatus === 'done') list = list.filter((t) => t.done);
  const el = document.getElementById('fullTaskList');
  el.innerHTML = list.length ? list.map(taskRowHtml).join('') : '<div class="empty">Ничего не найдено по этому фильтру.</div>';
  bindTaskActions(el);
}
