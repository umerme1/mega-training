// Records the board in use with Playwright and writes the timings + ack receipt next to the video.
// usage: node record.mjs <boardUrl> <outName> [--no-ack] [--watch-seconds N] [--locale en-AU] [--tz Australia/Sydney]
import { chromium } from 'playwright';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

const [,, boardUrl, outName, ...rest] = process.argv;
if (!boardUrl || !outName) { console.error('usage: node record.mjs <boardUrl> <outName> [--no-ack] [--watch-seconds N]'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const doAck = !rest.includes('--no-ack');
const watchSeconds = Number(opt('--watch-seconds', '20'));
const locale = opt('--locale', 'en-AU'); const tz = opt('--tz', 'Australia/Sydney');
mkdirSync('proof', { recursive: true });

const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'proof/tmp', size: { width: 1280, height: 800 } }, locale, timezoneId: tz });
const t0 = Date.now(); // the video starts with the context
const page = await context.newPage();
const marks = { locale, tz, boardUrl, startedAt: new Date(t0).toISOString(), events: [] };
const mark = (name, extra = {}) => { const e = { name, at: mmss(Date.now() - t0), iso: new Date().toISOString(), ...extra }; marks.events.push(e); console.log(JSON.stringify(e)); };
let receipt = null;
page.on('console', (msg) => {
  const parts = msg.args();
  if (msg.type() === 'info' && msg.text().startsWith('ack ')) {
    const [, id, ackedAt, rec] = msg.text().split(' ');
    receipt = { id, ackedAt, receipt: rec };
    mark('ack-receipt-logged', receipt);
  }
});

mark('open-board', { note: 'navigating to the board' });
await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });
const loader = page.getByTestId('loader');
try { await loader.waitFor({ state: 'visible', timeout: 3000 }); mark('loader-visible'); } catch { mark('loader-not-caught', { note: 'incidents loaded before the loader could be seen' }); }
await page.getByTestId('incident-row').first().waitFor({ timeout: 15000 });
await loader.waitFor({ state: 'hidden', timeout: 15000 });
const sha = await page.locator('meta[name="build"]').getAttribute('content');
const rows = await page.getByTestId('incident-row').count();
mark('incidents-visible', { rows, sha, footerSha: (await page.getByTestId('build-sha').textContent())?.trim() });
await page.waitForTimeout(4000);

if (doAck) {
  const firstRow = page.getByTestId('incident-row').first();
  const id = await firstRow.getAttribute('data-id');
  const btn = firstRow.getByTestId('ack');
  await btn.hover(); await page.waitForTimeout(800);
  mark('ack-click', { id });
  await btn.click();
  await firstRow.getByTestId('acked').waitFor({ timeout: 15000 });
  mark('acked-visible', { id });
  await page.waitForTimeout(3000);
}

const statusBefore = await page.getByTestId('status').textContent();
mark('watch-start', { status: statusBefore?.trim() });
await page.waitForTimeout(watchSeconds * 1000);
const statusAfter = await page.getByTestId('status').textContent();
const rowsAfter = await page.getByTestId('incident-row').count();
mark('watch-end', { status: statusAfter?.trim(), rows: rowsAfter, statusChanged: statusBefore !== statusAfter });
await page.waitForTimeout(1500);
const video = page.video();
await context.close();
const tmpPath = await video.path();
const finalPath = `proof/${outName}.webm`;
renameSync(tmpPath, finalPath);
marks.video = finalPath; marks.durationApprox = mmss(Date.now() - t0); marks.receipt = receipt; marks.sha = sha;
writeFileSync(`proof/${outName}.json`, JSON.stringify(marks, null, 2));
console.log(`video: ${finalPath}  duration ~${marks.durationApprox}  sha ${sha}  receipt ${receipt ? 'yes' : 'none'}`);
await browser.close();
