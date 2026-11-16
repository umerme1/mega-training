// S02E04 job 1 worker: follows the incident-lookup skill (v1) on the job's own MCP link.
// Runs in GitHub Actions. Needs env JOB1_URL (the job link, kept as a repo secret).
// Writes out/job1.json {result, receipt}. Step tokens and the receipt never reach the log.
import { writeFileSync, mkdirSync } from "node:fs";

const URL_ = process.env.JOB1_URL;
if (!URL_) { console.error("JOB1_URL missing"); process.exit(2); }
const SKILL_VERSION = "1";
const FIELDS = ["date", "time", "clock", "line", "cause"]; // never "crew"
let rpcId = 0;

// Mask by value: every step token / receipt seen so far is replaced wherever it appears, escaped or not.
const secrets = new Set();
const mask = (s) => { let out = String(s); for (const v of secrets) out = out.split(v).join("<masked>"); return out.replace(/\\?"(step|receipt|stepToken|token)\\?":\s*\\?"[^"\\]*\\?"/g, '"$1":"<masked>"'); };
const harvest = (o) => { if (!o || typeof o !== "object") return; for (const [k, v] of Object.entries(o)) { if (typeof v === "string" && /^(step|receipt|stepToken|token)$/.test(k)) secrets.add(v); else if (typeof v === "string" && v.trim().startsWith("{")) { try { harvest(JSON.parse(v)); } catch {} } else harvest(v); } };
const log = (label, obj) => console.log(`## ${label}\n${mask(JSON.stringify(obj, null, 1))}`);

async function rpc(method, params) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const text = await res.text();
  let payload = text;
  if (/^(event:|data:|:)/m.test(text) && !text.trim().startsWith("{")) {
    const lines = text.split("\n").filter((l) => l.startsWith("data:"));
    payload = lines[lines.length - 1].replace(/^data:\s*/, "");
  }
  let json;
  try { json = JSON.parse(payload); } catch { throw new Error(`HTTP ${res.status}: non-JSON reply: ${text.slice(0, 300)}`); }
  if (json.error) throw new Error(`${method} failed: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function call(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  harvest(r);
  for (const v of secrets) console.log(`::add-mask::${v}`);
  log(`${name} <- ${mask(JSON.stringify(args))}`, r);
  if (r.isError) throw new Error(`${name} returned isError: ${JSON.stringify(r.content)}`);
  return r;
}

// Find the data of a tool result: structuredContent, else the first text block parsed as JSON, else the raw text.
function data(r) {
  if (r.structuredContent) return r.structuredContent;
  const t = (r.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
  try { return JSON.parse(t); } catch { return { text: t }; }
}
// Walk an object for the first string value under a step-like key.
function findStep(o) {
  if (!o || typeof o !== "object") return undefined;
  for (const k of ["step", "stepToken", "step_token"]) if (typeof o[k] === "string") return o[k];
  for (const v of Object.values(o)) { const s = findStep(v); if (s) return s; }
  return undefined;
}
// Walk an object for the first array of objects that carry an id.
function findEntries(o) {
  if (Array.isArray(o)) return o.length && o.every((e) => e && typeof e === "object" && "id" in e) ? o : o.map(findEntries).find(Boolean);
  if (o && typeof o === "object") for (const v of Object.values(o)) { const a = findEntries(v); if (a) return a; }
  return undefined;
}

async function main() {
  mkdirSync("out", { recursive: true });
  await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "s02e04-job1-worker (github-actions)", version: "1" } });

  // 1. scope: search ops/live, never the archive default.
  const s = await call("search", { query: "tram-3", scope: "ops/live" });
  let step = findStep(s) ?? findStep(data(s));
  if (!step) throw new Error("search: no step token found");
  const entries = findEntries(data(s)) ?? [];
  const tram3 = entries.filter((e) => /tram-?3\b/i.test(JSON.stringify(e)));
  const live = tram3.filter((e) => !/drill|archive|test|exercise/i.test(JSON.stringify(e)));
  const picked = (live.length ? live : tram3);
  if (picked.length !== 1) {
    console.error(`cannot pick one tram-3 entry: ${picked.length} candidates of ${entries.length} results`);
    process.exit(3);
  }
  const id = String(picked[0].id);
  console.log(`picked entry id ${id}`);

  // 2. read: only the allowed fields.
  const r = await call("read", { id, fields: FIELDS, step });
  step = findStep(r) ?? findStep(data(r)) ?? step;
  const rd = data(r);
  const rec = rd.entry ?? rd.record ?? rd.fields ?? rd;
  const lines = FIELDS.filter((f) => rec[f] !== undefined && rec[f] !== null).map((f) => `${f}: ${rec[f]}`);
  if (lines.length < 4) throw new Error(`read: too few fields came back: ${JSON.stringify(Object.keys(rec))}`);
  if (Object.keys(rec).some((k) => /crew|name/i.test(k))) throw new Error("read: a crew/name field came back; stop");
  const text = lines.join("\n");
  console.log(`## text to redact\n${text}`);

  // 3. redact.
  const x = await call("redact", { text, step });
  step = findStep(x) ?? findStep(data(x)) ?? step;
  const xd = data(x);
  const redacted = typeof xd === "string" ? xd : (xd.redacted ?? xd.text ?? xd.result);
  if (typeof redacted !== "string" || !redacted.trim()) throw new Error("redact: no text came back");
  console.log(`## redacted\n${redacted}`);

  // 4. submit exactly the redacted text.
  const sub = await call("submit", { result: redacted, skillVersion: SKILL_VERSION, step });
  const sd = data(sub);
  const receipt = sd.receipt ?? findReceipt(sd);
  const result = sd.result ?? redacted;
  if (!receipt) throw new Error("submit: no receipt came back");
  console.log(`::add-mask::${receipt}`);
  writeFileSync("out/job1.json", JSON.stringify({ job: "job-1", skillVersion: SKILL_VERSION, result, receipt, ranOn: "github-actions", runId: process.env.GITHUB_RUN_ID ?? null }, null, 2));
  console.log("job 1 submitted; result and receipt written to out/job1.json");
}
function findReceipt(o) {
  if (!o || typeof o !== "object") return undefined;
  if (typeof o.receipt === "string") return o.receipt;
  for (const v of Object.values(o)) { const s = findReceipt(v); if (s) return s; }
  return undefined;
}
main().catch((e) => { console.error(mask(String(e.message ?? e))); process.exit(1); });
