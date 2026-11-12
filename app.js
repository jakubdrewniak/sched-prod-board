import { fetchIncidents, ack } from './api.js';

const REFRESH_MS = 2000; // R4
const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

const acked = new Map(); // incident id -> ackedAt (survives refreshes)
const pending = new Set(); // ids with an ack in flight

// R5: viewer's local time and the locale's own day/month order (en-GB, de-DE, fr-FR … print dd/mm).
const fmt = new Intl.DateTimeFormat(navigator.languages?.length ? navigator.languages : undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const localTime = (iso) => fmt.format(new Date(iso));

function rowHtml(i) {
  const mark = acked.has(i.id) ? `<span data-testid="acked" class="acked">acked</span>` : '<span class="open" aria-hidden="true">›</span>';
  return `<span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
    ${mark}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// R1: render newest first, keyed by id: existing rows are reused, never removed and rebuilt; new ones go on top.
function render(incidents) {
  const seen = new Set();
  let prev = null;
  for (const i of incidents) {
    seen.add(i.id);
    let li = list.querySelector(`[data-testid="incident-row"][data-id="${CSS.escape(i.id)}"]`);
    const html = rowHtml(i);
    if (!li) {
      li = document.createElement('li');
      li.dataset.testid = 'incident-row';
      li.dataset.id = i.id;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
    }
    li.className = `row ${i.severity}${acked.has(i.id) ? ' is-acked' : ''}${i.id === panelId ? ' is-open' : ''}`;
    li.setAttribute('aria-label', `Open ${i.id}`);
    if (li._html !== html) {
      li.innerHTML = html;
      li._html = html;
    }
    const want = prev ? prev.nextSibling : list.firstChild;
    if (li !== want) list.insertBefore(li, want);
    prev = li;
  }
  for (const li of [...list.children]) if (!seen.has(li.dataset.id)) li.remove();
  empty.hidden = incidents.length > 0;
  if (panelId) renderPanel();
}

// R2 (product, after the 00:10 ack race): Ack leaves the row. A row opens its incident panel, and Ack lives
// there. The panel is bound to the incident id it was opened for, so rows moving under the pointer can only
// open the wrong panel (which names its incident), never ack the wrong incident.
const panel = document.querySelector('[data-testid="incident-panel"]');
let panelId = null;

function renderPanel() {
  const i = byId.get(panelId);
  if (!panelId || !i) {
    panel.hidden = true;
    return;
  }
  const html = `<h2 class="panel-id">${esc(i.id)}</h2>
    <p class="panel-sev ${esc(i.severity)}">${esc(i.severity)} · ${esc(i.service)} · ${esc(i.region)}</p>
    <p class="panel-what">${esc(i.summary)}</p>
    <p class="panel-time">opened <time></time></p>
    ${acked.has(i.id)
      ? `<p data-testid="acked" class="acked">acked</p>`
      : `<button type="button" data-testid="panel-ack" class="ack"${pending.has(i.id) ? ' disabled' : ''}>Ack ${esc(i.id)}</button>`}
    <button type="button" class="close" aria-label="Close panel">×</button>`;
  panel.dataset.id = i.id;
  if (panel._html !== html) {
    panel.innerHTML = html;
    panel._html = html;
  }
  const t = panel.querySelector('time');
  t.dateTime = i.openedAt;
  t.textContent = localTime(i.openedAt);
  panel.hidden = false;
}

function openPanel(id) {
  panelId = id;
  for (const li of list.children) li.classList.toggle('is-open', li.dataset.id === id);
  renderPanel();
}

list.addEventListener('click', (e) => {
  const li = e.target.closest('[data-testid="incident-row"]');
  if (li) openPanel(li.dataset.id);
});
list.addEventListener('keydown', (e) => {
  const li = e.target.closest('[data-testid="incident-row"]');
  if (li && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openPanel(li.dataset.id);
  }
});

panel.addEventListener('click', async (e) => {
  if (e.target.closest('.close')) return openPanel(null);
  if (!e.target.closest('[data-testid="panel-ack"]')) return;
  const id = panel.dataset.id; // the incident this panel names, not whatever row is under the pointer now
  if (pending.has(id) || acked.has(id)) return;
  pending.add(id);
  renderPanel();
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt);
  } catch (err) {
    console.error(err);
  } finally {
    pending.delete(id);
    if (last) render(last);
    renderPanel();
  }
});

const byId = new Map();
let last = null;
async function refresh() {
  try {
    const page = await fetchIncidents();
    last = page.incidents;
    for (const i of last) byId.set(i.id, i);
    render(last);
    board.dataset.updatedAt = page.updatedAt;
  } catch (err) {
    console.error(err);
  }
}

// R3: loader until the first answer is on screen.
await refresh();
loader.remove();
list.hidden = false;

// R4: refresh every 2 s while the page is open.
setInterval(refresh, REFRESH_MS);
