import './styles/main.css';
import { state } from './modules/store.js';
import * as queries from './api/queries.js';
import { setUserKey } from './api/queries.js';
import * as auth from './modules/auth.js';
import { saveCache, loadCache, isNetworkError } from './modules/offline.js';
import { applyDailyTick, renderHud } from './modules/profile.js';
import { addTask, renderDashTasks, renderTasks } from './modules/tasks.js';
import { addProject, renderProjects, fillProjectSelects } from './modules/projects.js';
import { loadHealth, renderHealth, logSleepEntry, logMovementEntry, saveIntervals } from './modules/health.js';
import { renderReminders, startReminderLoop } from './modules/reminders.js';

let appStarted = false;
let currentUserKey = null;

async function loadState() {
  try {
    const [profile, projects, tasks] = await Promise.all([queries.getProfile(), queries.getProjects(), queries.getTasks()]);
    state.profile = profile;
    state.projects = projects;
    state.tasks = tasks;
    await loadHealth();
    saveCache(currentUserKey, state);
    setOffline(false);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const cached = loadCache(currentUserKey);
    if (!cached) throw err;
    Object.assign(state, cached);
    setOffline(true);
  }
}

function setOffline(isOffline) {
  document.getElementById('offlineBanner').classList.toggle('show', isOffline);
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
  document.getElementById('logoutBtn').addEventListener('click', () => auth.logout());

  document.getElementById('qaTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask('qa'); });
  document.getElementById('taskTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask('full'); });
  document.getElementById('newProjName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProject(); });

  // Данные из Apple Health (через Shortcuts) пишутся в базу в фоне — подхватываем их
  // при возврате на вкладку, без ручного обновления страницы.
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && appStarted) {
      try {
        await loadHealth();
        renderHealth();
        setOffline(false);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        setOffline(true);
      }
    }
  });
}

/* ---------- Экран входа/регистрации ---------- */
let authMode = 'login';

function wireAuth() {
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      authMode = tab.dataset.authtab;
      document.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.getElementById('authSubmitBtn').textContent = authMode === 'login' ? 'Войти' : 'Создать аккаунт';
      document.getElementById('authError').textContent = '';
    });
  });

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('authUsername').value;
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');
    errorEl.textContent = '';
    submitBtn.disabled = true;
    try {
      if (authMode === 'login') await auth.login(username, password);
      else await auth.register(username, password);
      // onAuthChange подхватит сессию и запустит вход в приложение
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

async function enterApp(session) {
  if (appStarted) return;
  appStarted = true;
  currentUserKey = session.user.id;
  setUserKey(currentUserKey);
  document.getElementById('userName').textContent = auth.getUsername(session);
  document.getElementById('avatarInitial').textContent = auth.getUsername(session).slice(0, 1).toUpperCase();
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  await loadState();
  await applyDailyTick();
  renderAll();
  startReminderLoop();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}

async function init() {
  wireNav();
  wireEvents();
  wireAuth();
  registerServiceWorker();

  const session = await auth.getSession();
  if (session) {
    await enterApp(session);
  } else {
    showAuthScreen();
  }

  auth.onAuthChange((session) => {
    if (session) {
      enterApp(session);
    } else if (appStarted) {
      appStarted = false;
      currentUserKey = null;
      window.location.reload();
    }
  });
}

init();
