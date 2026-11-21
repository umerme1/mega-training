// sched-prod incident board. Plan R1–R6; hooks pinned in plan.md.
import { fetchIncidents, ack } from './api.js';

const board = document.querySelector('[data-testid="board"]');
const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('[data-testid="status"]');

const REFRESH_MS = 2000; // R4
const incidents = new Map(); // id → incident, newest first when sorted by openedAt
const acked = new Map(); // id → ackedAt
let loaded = false;

// R5: the viewer's local time in the viewer's own order (dd/mm for EU locales, mm/dd for en-US); full UTC stays in datetime.
const fmt = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const localTime = (iso) => fmt.format(new Date(iso));
const fmtClock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
let refreshes = 0;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function row(i) {
  const isAcked = acked.has(i.id);
  return `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}${isAcked ? ' is-acked' : ''}">
    <span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
    ${isAcked
      ? `<span data-testid="acked" class="acked" title="acked ${esc(acked.get(i.id))}">acked ✓</span>`
      : `<button type="button" data-testid="ack" class="ack" data-id="${esc(i.id)}">Ack</button>`}
  </li>`;
}

function render() {
  const sorted = [...incidents.values()].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt)); // R1 newest first
  list.innerHTML = sorted.map(row).join('');
  empty.hidden = sorted.length > 0;
  list.hidden = sorted.length === 0;
}

async function refresh() {
  try {
    const page = await fetchIncidents();
    for (const i of page.incidents) incidents.set(i.id, i);
    if (!loaded) { loaded = true; loader.hidden = true; board.dataset.loaded = 'true'; } // R3
    render();
    refreshes += 1;
    status.textContent = `live · ${incidents.size} incident${incidents.size === 1 ? '' : 's'} · refreshed ${refreshes}× · last ${fmtClock.format(new Date())}`;
    status.dataset.state = 'ok';
  } catch (err) {
    status.textContent = `could not refresh: ${err.message}`;
    status.dataset.state = 'error';
  }
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.dataset.id;
  btn.disabled = true;
  btn.textContent = 'acking…';
  try {
    const reply = await ack(id); // R2
    acked.set(id, reply.ackedAt);
    render();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Ack';
    const li = btn.closest('li');
    let e2 = li.querySelector('.err');
    if (!e2) { e2 = document.createElement('span'); e2.className = 'err'; li.appendChild(e2); }
    e2.textContent = `ack failed: ${err.message}`;
  }
});

await refresh();
setInterval(refresh, REFRESH_MS); // R4
