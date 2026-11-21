// Records the ack race the way a person meets it: hover a row's Ack, a new incident lands at the top, click where the
// button was. Writes the timings, the row meant and the receipt (which row was acked) next to the video.
// usage: node record-race.mjs <boardUrl> <outName> [--row N] [--max-wait-seconds S] [--attempts K]
import { chromium } from 'playwright';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';

const [,, boardUrl, outName, ...rest] = process.argv;
if (!boardUrl || !outName) { console.error('usage: node record-race.mjs <boardUrl> <outName> [--row N] [--max-wait-seconds S] [--attempts K]'); process.exit(2); }
const opt = (k, d) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : d; };
const rowIndex = Number(opt('--row', '1')); const maxWait = Number(opt('--max-wait-seconds', '300')); const attempts = Number(opt('--attempts', '3'));
mkdirSync('proof/tmp', { recursive: true });
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: 'proof/tmp', size: { width: 1280, height: 800 } }, locale: 'en-AU', timezoneId: 'Australia/Sydney' });
const t0 = Date.now();
const page = await context.newPage();
const marks = { boardUrl, startedAt: new Date(t0).toISOString(), events: [], acks: [] };
const mark = (name, extra = {}) => { const e = { name, at: mmss(Date.now() - t0), iso: new Date().toISOString(), ...extra }; marks.events.push(e); console.log(JSON.stringify(e)); return e; };
page.on('console', (msg) => {
  if (msg.type() === 'info' && msg.text().startsWith('ack ')) { const [, id, ackedAt, receipt] = msg.text().split(' '); marks.acks.push({ id, ackedAt, receipt, at: mmss(Date.now() - t0) }); mark('ack-receipt', { id, ackedAt }); }
});

mark('open-board');
await page.goto(boardUrl, { waitUntil: 'domcontentloaded' });
await page.getByTestId('incident-row').first().waitFor({ timeout: 15000 });
await page.getByTestId('loader').waitFor({ state: 'hidden', timeout: 15000 });
const sha = await page.locator('meta[name="build"]').getAttribute('content');
mark('incidents-visible', { rows: await page.getByTestId('incident-row').count(), sha });
await page.waitForTimeout(2500);

const ids = async () => page.getByTestId('incident-row').evaluateAll((els) => els.map((e) => e.dataset.id));
let race = null;
for (let attempt = 1; attempt <= attempts && !race; attempt++) {
  const before = await ids();
  const meantId = before[rowIndex];
  const btn = page.locator(`[data-testid="incident-row"][data-id="${meantId}"] [data-testid="ack"]`);
  const box = await btn.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); // hover: the button darkens, like a person about to click
  mark('hover-ack', { attempt, meantId, rowIndex, x: Math.round(x), y: Math.round(y) });
  // wait, like a person reading the row, until a new incident lands at the top
  const waitStart = Date.now(); let landed = null;
  while (Date.now() - waitStart < maxWait * 1000) {
    const now = await ids();
    if (now.length > before.length || now[0] !== before[0]) { landed = now[0]; break; }
    await page.waitForTimeout(150);
  }
  if (!landed) { mark('no-new-incident', { attempt, waitedSeconds: Math.round((Date.now() - waitStart) / 1000) }); continue; }
  mark('new-incident-landed', { attempt, landed });
  const ackCountBefore = marks.acks.length;
  await page.mouse.click(x, y); // the click goes where the button WAS
  const clickMark = mark('click-where-ack-was', { attempt, meantId, x: Math.round(x), y: Math.round(y) });
  await page.waitForTimeout(2500);
  const ackedId = marks.acks.length > ackCountBefore ? marks.acks[marks.acks.length - 1].id : null;
  const after = await ids();
  const under = after[after.indexOf(meantId) >= 0 ? Math.max(0, after.indexOf(meantId) - 1) : rowIndex];
  const outcome = { attempt, meantId, ackedId, landed, rowNowAtThatSpot: under, clickAt: clickMark.at, misbehaved: ackedId !== null && ackedId !== meantId };
  mark('outcome', outcome);
  if (outcome.misbehaved || ackedId === null) race = outcome; // a wrong-row ack, or a swallowed click, is the misbehaviour
  await page.waitForTimeout(2000);
}
await page.waitForTimeout(3000);
const video = page.video(); await context.close();
const finalPath = `proof/${outName}.webm`; renameSync(await video.path(), finalPath);
marks.video = finalPath; marks.durationApprox = mmss(Date.now() - t0); marks.sha = sha; marks.race = race;
writeFileSync(`proof/${outName}.json`, JSON.stringify(marks, null, 2));
console.log(`video: ${finalPath}  duration ~${marks.durationApprox}  sha ${sha}  race ${race ? JSON.stringify(race) : 'not reproduced'}`);
await browser.close();
