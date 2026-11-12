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
  const isAcked = acked.has(i.id);
  const action = isAcked
    ? `<span data-testid="acked" class="acked">acked</span>`
    : `<button type="button" data-testid="ack" class="ack"${pending.has(i.id) ? ' disabled' : ''}>Ack</button>`;
  return `<span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
    ${action}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// R1: render newest first, keyed by id, so existing rows (and a button under the pointer) are reused, not rebuilt.
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
    }
    li.className = `row ${i.severity}${acked.has(i.id) ? ' is-acked' : ''}`;
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
}

// R2: Ack the incident whose row holds the clicked button.
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.closest('[data-testid="incident-row"]').dataset.id;
  pending.add(id);
  btn.disabled = true;
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt);
  } catch (err) {
    console.error(err);
  } finally {
    pending.delete(id);
    if (last) render(last);
  }
});

let last = null;
async function refresh() {
  try {
    const page = await fetchIncidents();
    last = page.incidents;
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
