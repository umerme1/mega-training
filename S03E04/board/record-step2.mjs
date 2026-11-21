// Records the rebuilt board like a person uses it: watch, aim at a row while a new incident lands, click,
// read the panel, correct the pick if needed, ack from the panel. Writes timings + receipts next to the video.
// usage: node record-step2.mjs <boardUrl> <outName> [--row N] [--max-wait-seconds S]
import { chromium } from 'playwright';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

const [,, boardUrl, outName, ...rest] = process.argv;
if (!boardUrl || !outName) { console.error('usage: node record-step2.mjs <boardUrl> <outName>'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const rowIndex = Number(opt('--row', '2')); const maxWait = Number(opt('--max-wait-seconds', '180'));
mkdirSync('proof/tmp', { recursive: true });
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'proof/tmp', size: { width: 1280, height: 800 } }, locale: 'en-AU', timezoneId: 'Australia/Sydney' });
const t0 = Date.now();
const page = await context.newPage();
const marks = { boardUrl, startedAt: new Date(t0).toISOString(), events: [], acks: [] };
const mark = (name, extra = {}) => { const e = { name, at: mmss(Date.now() - t0), iso: new Date().toISOString(), ...extra }; marks.events.push(e); console.log(JSON.stringify(e)); return e; };
page.on('console', (msg) => { if (msg.type() === 'info' && msg.text().startsWith('ack ')) { const [, id, ackedAt, receipt] = msg.text().split(' '); marks.acks.push({ id, ackedAt, receipt, at: mmss(Date.now() - t0) }); mark('ack-receipt', { id, ackedAt }); } });
await page.addInitScript(() => { window.__rowsRemoved = 0; new MutationObserver((rs) => { for (const r of rs) for (const n of r.removedNodes) if (n.nodeType === 1 && n.matches?.('[data-testid="incident-row"]')) window.__rowsRemoved++; }).observe(document, { childList: true, subtree: true }); });

mark('open-board');
await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });
await page.getByTestId('incident-row').first().waitFor({ timeout: 15000 });
await page.getByTestId('loader').waitFor({ state: 'hidden', timeout: 15000 });
const sha = await page.locator('meta[name="build"]').getAttribute('content');
const ids = async () => page.getByTestId('incident-row').evaluateAll((els) => els.map((e) => e.dataset.id));
mark('incidents-visible', { rows: (await ids()).length, sha, rowHasAckButton: (await page.locator('[data-testid="incident-row"] [data-testid="ack"]').count()) > 0 });
await page.waitForTimeout(3000);

// aim at a row like a person, let a new incident land, then click where the pointer is
const before = await ids(); const meantId = before[rowIndex];
const target = page.locator(`[data-testid="incident-row"][data-id="${meantId}"]`);
const box = await target.boundingBox(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
await page.mouse.move(x, y, { steps: 8 });
mark('aim-at-row', { meantId, rowIndex, x: Math.round(x), y: Math.round(y) });
const waitStart = Date.now(); let landed = null;
while (Date.now() - waitStart < maxWait * 1000) { const now = await ids(); if (now[0] !== before[0]) { landed = now[0]; break; } await page.waitForTimeout(150); }
mark(landed ? 'new-incident-landed' : 'no-new-incident', { landed, waitedSeconds: Math.round((Date.now() - waitStart) / 1000) });
await page.mouse.click(x, y);
await page.waitForTimeout(500);
const panel = page.getByTestId('incident-panel');
let panelId = (await panel.getAttribute('data-id').catch(() => null));
mark('panel-open', { panelNames: panelId, meantId, matches: panelId === meantId });
if (panelId !== meantId) {
  await page.locator(`[data-testid="incident-row"][data-id="${meantId}"]`).click();
  await page.waitForTimeout(500);
  panelId = await panel.getAttribute('data-id');
  mark('repick-row', { panelNames: panelId, meantId, matches: panelId === meantId });
}
await page.waitForTimeout(1500);
const ackBtn = page.getByTestId('panel-ack');
await ackBtn.hover(); await page.waitForTimeout(600);
const n0 = marks.acks.length;
mark('panel-ack-click', { panelNames: panelId });
await ackBtn.click();
await page.locator(`[data-testid="incident-row"][data-id="${meantId}"] [data-testid="acked"]`).waitFor({ timeout: 10000 });
const got = marks.acks.length > n0 ? marks.acks[marks.acks.length - 1].id : null;
mark('acked-visible', { meantId, ackedId: got, matches: got === meantId });
await page.waitForTimeout(3000);
const statusBefore = await page.getByTestId('status').textContent();
mark('watch-start', { status: statusBefore?.trim(), rows: (await ids()).length });
await page.waitForTimeout(12000);
mark('watch-end', { status: (await page.getByTestId('status').textContent())?.trim(), rows: (await ids()).length, rowsRemoved: await page.evaluate(() => window.__rowsRemoved), panelStillNames: await panel.getAttribute('data-id') });
await page.waitForTimeout(1500);
const video = page.video(); await context.close();
const finalPath = `proof/${outName}.webm`; renameSync(await video.path(), finalPath);
marks.video = finalPath; marks.durationApprox = mmss(Date.now() - t0); marks.sha = sha; marks.meantId = meantId; marks.ackedId = got;
writeFileSync(`proof/${outName}.json`, JSON.stringify(marks, null, 2));
console.log(`video: ${finalPath}  duration ~${marks.durationApprox}  sha ${sha}  meant ${meantId} acked ${got}`);
await browser.close();
