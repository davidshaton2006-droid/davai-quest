import { state } from './store.js';
import * as queries from '../api/queries.js';
import { escapeHtml, PROJECT_COLORS } from '../utils/helpers.js';

export async function addProject() {
  const inp = document.getElementById('newProjName');
  const name = inp.value.trim();
  if (!name) return;
  const color = PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length];
  const created = await queries.createProject(name, color);
  state.projects.push(created);
  inp.value = '';
  fillProjectSelects();
  renderProjects();
}

export function renderProjects() {
  const grid = document.getElementById('projectGrid');
  grid.innerHTML = state.projects
    .map((p) => {
      const tasks = state.tasks.filter((t) => t.project_id === p.id);
      const done = tasks.filter((t) => t.done).length;
      const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
      return (
        '<div class="proj-card"><div class="glow" style="background:' + p.color + '"></div>' +
        '<div class="proj-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="proj-sub">' + tasks.length + ' задач · ' + done + ' выполнено</div>' +
        '<div class="proj-bar-track"><div class="proj-bar-fill" style="width:' + pct + '%;background:' + p.color + '"></div></div>' +
        '<div class="proj-stats"><span>' + pct + '% готово</span><span>ID: ' + p.id.slice(0, 6) + '</span></div>' +
        '</div>'
      );
    })
    .join('');
}

export function fillProjectSelects() {
  const opts = state.projects.map((p) => '<option value="' + p.id + '">' + escapeHtml(p.name) + '</option>').join('');
  ['qaProject', 'taskProject'].forEach((id) => {
    document.getElementById(id).innerHTML = opts;
  });
  document.getElementById('filterProject').innerHTML = '<option value="all">Все проекты</option>' + opts;
}
