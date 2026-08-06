import './styles/main.css';
import { state } from './modules/store.js';
import * as queries from './api/queries.js';
import { applyDailyTick, renderHud } from './modules/profile.js';
import { addTask, renderDashTasks, renderTasks } from './modules/tasks.js';
import { addProject, renderProjects, fillProjectSelects } from './modules/projects.js';
import { loadHealth, renderHealth, logSleepEntry, logMovementEntry, saveIntervals } from './modules/health.js';
import { renderReminders, startReminderLoop } from './modules/reminders.js';

async function loadState() {
  const [profile, projects, tasks] = await Promise.all([queries.getProfile(), queries.getProjects(), queries.getTasks()]);
  state.profile = profile;
  state.projects = projects;
  state.tasks = tasks;
  await loadHealth();
}

function renderAll() {
  fillProjectSelects();
  renderHud();
  renderDashTasks();
  renderTasks();
  renderProjects();
  renderHealth();
  renderReminders();
}

function wireNav() {
  document.querySelectorAll('.nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav button').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

function wireEvents() {
  document.getElementById('qaAddBtn').addEventListener('click', () => addTask('qa'));
  document.getElementById('taskAddBtn').addEventListener('click', () => addTask('full'));
  document.getElementById('addProjBtn').addEventListener('click', () => addProject());
  document.getElementById('logSleepBtn').addEventListener('click', () => logSleepEntry());
  document.getElementById('logMoveBtn').addEventListener('click', () => logMovementEntry());
  document.getElementById('saveIntervalsBtn').addEventListener('click', () => saveIntervals());
  document.getElementById('filterProject').addEventListener('change', () => renderTasks());
  document.getElementById('filterStatus').addEventListener('change', () => renderTasks());

  document.getElementById('qaTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask('qa'); });
  document.getElementById('taskTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask('full'); });
  document.getElementById('newProjName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProject(); });

  // Данные из Apple Health (через Shortcuts) пишутся в базу в фоне — подхватываем их
  // при возврате на вкладку, без ручного обновления страницы.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await loadHealth();
      renderHealth();
    }
  });
}

async function init() {
  wireNav();
  wireEvents();
  await loadState();
  await applyDailyTick();
  renderAll();
  startReminderLoop();
}

init();
