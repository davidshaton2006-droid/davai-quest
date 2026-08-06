export const PROJECT_COLORS = ['#3ff0ff', '#ff3fb0', '#ffb92e', '#39ff8f', '#7d7dff', '#ff7a5c'];

export function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function todayStr(d) {
  const dt = d ? new Date(d) : new Date();
  return dt.toISOString().slice(0, 10);
}

export function last7Dates() {
  const arr = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push(todayStr(d));
  }
  return arr;
}

export function showToast(title, body) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = '<b>' + escapeHtml(title) + '</b><p>' + escapeHtml(body) + '</p>';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5100);
}
