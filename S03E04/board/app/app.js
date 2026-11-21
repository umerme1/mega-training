// sched-prod incident board. Plan R1–R7; hooks pinned in plan.md.
// Product's decision (step 1 report, 2026-11-21): new incidents stay live at the top; Ack leaves the row.
// A row opens its incident panel, and Ack lives there. Rows update in place and never leave the board while it is open.
import { fetchIncidents, ack } from './api.js';

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('[data-testid="status"]');
const panel = document.querySelector('[data-testid="incident-panel"]');

const REFRESH_MS = 2000; // R4
const incidents = new Map(); // id → incident
const rowsById = new Map(); // id → <li>, kept for the life of the page (R7: rows update in place)
const acked = new Map(); // id → ackedAt
let loaded = false;
let selectedId = null;

// R5: the viewer's local time in the viewer's own order (dd/mm for EU locales, mm/dd for en-US); full UTC stays in datetime.
const fmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const localTime = (iso) => fmt.format(new Date(iso));
const fmtClock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
let refreshes = 0;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function rowMarkup(i) {
  return `<span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
    <span class="mark"></span>`;
}

function updateRowState(li, id) {
  li.classList.toggle('is-selected', id === selectedId);
  li.setAttribute('aria-selected', id === selectedId ? 'true' : 'false');
  const mark = li.querySelector('.mark');
  if (acked.has(id)) {
    li.classList.add('is-acked');
    if (!mark.querySelector('[data-testid="acked"]')) mark.innerHTML = `<span data-testid="acked" class="acked" title="acked ${esc(acked.get(id))}">acked ✓</span>`;
  } else {
    li.classList.remove('is-acked');
    mark.textContent = 'open';
  }
}

// R1 + R7: new rows are inserted at their place (newest first); existing rows are updated in place, never removed.
function render() {
  const sorted = [...incidents.values()].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  let cursor = null; // the row before which the next one goes
  for (let k = sorted.length - 1; k >= 0; k--) {
    const i = sorted[k];
    let li = rowsById.get(i.id);
    if (!li) {
      li = document.createElement('li');
      li.dataset.testid = 'incident-row'; li.setAttribute('data-testid', 'incident-row');
      li.dataset.id = i.id; li.className = `row ${i.severity}`; li.tabIndex = 0; li.setAttribute('role', 'button');
      li.innerHTML = rowMarkup(i);
      list.insertBefore(li, cursor);
      rowsById.set(i.id, li);
    } else if (li.nextSibling !== cursor) {
      list.insertBefore(li, cursor); // moving a node is not removing it: the row stays on the board
    }
    updateRowState(li, i.id);
    cursor = li;
  }
  empty.hidden = sorted.length > 0;
  list.hidden = sorted.length === 0;
}

function renderPanel() {
  const i = selectedId ? incidents.get(selectedId) : null;
  if (!i) {
    panel.hidden = true; panel.innerHTML = ''; panel.removeAttribute('data-id'); return;
  }
  panel.hidden = false; panel.dataset.id = i.id;
  const isAcked = acked.has(i.id);
  panel.innerHTML = `
    <div class="panel-head"><h2>${esc(i.id)}</h2><button type="button" data-testid="panel-close" class="close" aria-label="Close panel">×</button></div>
    <dl>
      <dt>severity</dt><dd class="sev ${esc(i.severity)}">${esc(i.severity)}</dd>
      <dt>service</dt><dd>${esc(i.service)}</dd>
      <dt>region</dt><dd>${esc(i.region)}</dd>
      <dt>summary</dt><dd>${esc(i.summary)}</dd>
      <dt>opened</dt><dd><time datetime="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time> <span class="utc">(${esc(i.openedAt)} UTC)</span></dd>
    </dl>
    ${isAcked
      ? `<p class="acked" data-testid="panel-acked">acked ✓ at ${esc(localTime(acked.get(i.id)))}</p>`
      : `<button type="button" data-testid="panel-ack" class="ack" data-id="${esc(i.id)}">Ack ${esc(i.id)}</button><p class="hint">Acks this incident, ${esc(i.id)}, and nothing else.</p>`}
    <p class="err" data-testid="panel-error" hidden></p>`;
}

function select(id) {
  selectedId = id;
  for (const [rid, li] of rowsById) updateRowState(li, rid);
  renderPanel();
}

async function refresh() {
  try {
    const page = await fetchIncidents();
    for (const i of page.incidents) incidents.set(i.id, i);
    if (!loaded) { loaded = true; loader.hidden = true; board.dataset.loaded = 'true'; } // R3
    render();
    if (selectedId && !panel.querySelector('h2')) renderPanel();
    refreshes += 1;
    status.textContent = `live · ${incidents.size} incident${incidents.size === 1 ? '' : 's'} · refreshed ${refreshes}× · last ${fmtClock.format(new Date())}`;
    status.dataset.state = 'ok';
  } catch (err) {
    status.textContent = `could not refresh: ${err.message}`;
    status.dataset.state = 'error';
  }
}

// A row opens its panel (R2, product's decision). The panel names the incident; Ack lives there.
list.addEventListener('click', (e) => {
  const li = e.target.closest('[data-testid="incident-row"]');
  if (li) select(li.dataset.id);
});
list.addEventListener('keydown', (e) => {
  const li = e.target.closest('[data-testid="incident-row"]');
  if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(li.dataset.id); }
});

panel.addEventListener('click', async (e) => {
  if (e.target.closest('[data-testid="panel-close"]')) { select(null); return; }
  const btn = e.target.closest('[data-testid="panel-ack"]');
  if (!btn) return;
  const id = btn.dataset.id; // the panel's incident, never the row under the pointer
  btn.disabled = true; btn.textContent = `acking ${id}…`;
  try {
    const reply = await ack(id); // R2
    acked.set(id, reply.ackedAt);
    const li = rowsById.get(id); if (li) updateRowState(li, id);
    renderPanel();
  } catch (err) {
    btn.disabled = false; btn.textContent = `Ack ${id}`;
    const e2 = panel.querySelector('[data-testid="panel-error"]'); e2.hidden = false; e2.textContent = `ack failed: ${err.message}`;
  }
});

await refresh();
setInterval(refresh, REFRESH_MS); // R4
