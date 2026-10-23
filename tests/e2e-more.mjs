// Second end-to-end pass: app lock, password reset, shared wallets with a second
// user, CSV import, backup/restore, PDF, settle up, goals, offline queue and the worker.
// Usage: node tests/e2e-more.mjs http://localhost:3100 out-dir /path/to/web.log
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] || "http://localhost:3100";
const out = process.argv[3] || "e2e-shots-2";
const webLog = process.argv[4] || "/tmp/web.log";
fs.mkdirSync(out, { recursive: true });
const problems = [];
const log = (...a) => console.log("•", ...a);
const check = (cond, msg) => { if (!cond) { problems.push(msg); console.log("✗", msg); } else console.log("✓", msg); };

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
async function newUser(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Asia/Karachi", hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { problems.push(`pageerror ${page.url()}: ${e.message}`); console.log("PAGEERROR", e.message, (e.stack || "").split("\n").slice(0, 4).join(" / ")); });
  page.on("response", (r) => { if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  const email = `${name.toLowerCase()}+${Date.now()}@example.com`;
  await page.goto(base + "/login");
  const api = (method, url, data, raw) => page.evaluate(async ([method, url, data, raw]) => {
    const r = await fetch(url, { method, headers: raw ? { "content-type": "application/json" } : { "content-type": "application/json" }, body: raw ?? (data ? JSON.stringify(data) : undefined) });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { status: r.status, body: j };
  }, [method, url, data, raw]);
  const s = await api("POST", "/api/auth/signup", { name, email, password: "correct horse 42" });
  if (s.status !== 200) throw new Error("signup " + JSON.stringify(s));
  await api("POST", "/api/setup", { currency: "PKR", timezone: "Asia/Karachi", accounts: [{ name: "Cash", type: "cash", startingBalance: 500000 }, { name: "HBL", type: "bank", startingBalance: 10000000 }] });
  return { ctx, page, api, email, name };
}
const shot = async (page, n) => { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${n}.png` }); };

const ONLY = process.env.ONLY;
const A = await newUser("Shahmir");
const B = await newUser("Ayesha");
const accsA = (await A.api("GET", "/api/accounts")).body.accounts;
const hblA = accsA.find((a) => a.name === "HBL");
const cats = (await A.api("GET", "/api/categories")).body.categories;
const food = cats.find((c) => c.name === "Food");

// ---------- App lock with PIN ----------
check((await A.api("POST", "/api/lock/pin", { pin: "2580" })).status === 200, "set a PIN");
check((await A.api("PATCH", "/api/me", { lock: { enabled: true, faceId: false, autoLockSec: 0 } })).status === 200, "turn app lock on");
await A.page.goto(base + "/");
await A.page.waitForTimeout(800);
const lockedText = await A.page.getByText(/Pocket is locked/i).count();
check(lockedText > 0, "lock screen shows when the app opens");
await shot(A.page, "01-lock");
for (const k of ["1", "1", "1", "1"]) await A.page.getByRole("button", { name: k, exact: true }).click();
await A.page.waitForTimeout(900);
check((await A.page.getByText(/wrong pin/i).count()) > 0, "wrong PIN is rejected");
for (const k of ["2", "5", "8", "0"]) await A.page.getByRole("button", { name: k, exact: true }).click();
await A.page.waitForTimeout(1200);
check((await A.page.getByText(/Pocket is locked/i).count()) === 0, "right PIN unlocks");
await shot(A.page, "02-unlocked");
await A.api("PATCH", "/api/me", { lock: { enabled: false, faceId: false, autoLockSec: 60 } });

// ---------- Forgot / reset password ----------
const before = fs.readFileSync(webLog, "utf8").length;
check((await A.api("POST", "/api/auth/forgot", { email: A.email })).status === 200, "forgot password accepted");
await new Promise((r) => setTimeout(r, 500));
const tail = fs.readFileSync(webLog, "utf8").slice(before);
const link = tail.match(/https?:\/\/\S+reset-password\?token=[\w-]+/)?.[0];
check(!!link, "reset link was generated");
if (link) {
  const p = await A.ctx.newPage();
  await p.goto(link.replace(/^https?:\/\/[^/]+/, base));
  await shot(p, "03-reset");
  const pw = p.getByLabel(/new password/i).first();
  await pw.fill("brand new pass 99");
  const confirm = p.getByLabel(/confirm|again/i);
  if (await confirm.count()) await confirm.first().fill("brand new pass 99");
  await p.getByRole("button", { name: /save|reset|set|update/i }).first().click();
  await p.waitForTimeout(1500);
  check(!p.url().includes("reset-password"), `reset password moves on (now ${new URL(p.url()).pathname})`);
  await p.close();
  const lo = await A.api("POST", "/api/auth/login", { email: A.email, password: "brand new pass 99" });
  check(lo.status === 200, "can sign in with the new password");
}

// ---------- Shared wallet ----------
const home = (await A.api("POST", "/api/accounts", { name: "Home expenses", type: "bank", color: "#FF5A36", startingBalance: 0 })).body;
check((await A.api("POST", `/api/accounts/${home.id}/members`, { email: B.email })).status === 200, "invite Ayesha to Home expenses");
const invB = (await B.api("GET", "/api/accounts")).body;
check((invB.invites || []).length === 1, "Ayesha sees the invite");
await B.page.goto(base + "/wallets");
await B.page.waitForLoadState("networkidle");
await shot(B.page, "04-invite");
check((await B.api("POST", `/api/invites/${home.id}`, { accept: true })).status === 200, "Ayesha accepts");
const accsB = (await B.api("GET", "/api/accounts")).body.accounts;
check(accsB.some((a) => a.id === home.id), "shared wallet appears for Ayesha");
const catsB = (await B.api("GET", "/api/categories")).body.categories;
const r1 = await B.api("POST", "/api/transactions", { type: "expense", amount: 432000, account: home.id, category: catsB.find((c) => c.name === "Groceries").id, note: "Imtiaz", date: new Date().toISOString() });
check(r1.status === 201 || r1.status === 200, "Ayesha adds to the shared wallet");
const homeTx = (await A.api("GET", `/api/transactions?account=${home.id}`)).body.transactions || [];
check(homeTx.some((t) => t.note === "Imtiaz" && t.by && !t.by.me), "Shahmir sees Ayesha's expense");
await A.page.goto(base + `/wallets/${home.id}`);
await A.page.waitForLoadState("networkidle");
await shot(A.page, "05-shared-wallet");

// ---------- Splits & settle up ----------
await A.api("POST", "/api/transactions", { type: "expense", amount: 245000, account: hblA.id, category: food.id, note: "Lunch", date: new Date().toISOString(), split: { people: [{ name: "Hamza", amount: 122500 }] } });
const people = (await A.api("GET", "/api/people")).body;
const hamza = (people.people || people).find?.((p) => p.name === "Hamza");
check(!!hamza, "Hamza was created from the split");
if (hamza) {
  check((await A.api("POST", `/api/people/${hamza.id}/settle`, { account: hblA.id })).status === 200, "settle up with Hamza");
}
await A.page.goto(base + "/splits");
await A.page.waitForLoadState("networkidle");
await shot(A.page, "06-splits-settled");

// ---------- Goals ----------
const g = (await A.api("POST", "/api/goals", { name: "Trip to Baku", emoji: "✈️", target: 30000000, initial: 0 })).body;
check((await A.api("POST", `/api/goals/${g.id}/contribute`, { amount: 15000000, account: hblA.id })).status === 200, "add money to a goal");
check((await A.api("POST", `/api/goals/${g.id}/contribute`, { amount: -99999999 })).status === 400, "can't withdraw more than saved");
const notes = (await A.api("GET", "/api/notifications")).body;
check(JSON.stringify(notes).includes("50% there"), "goal milestone notification");

// ---------- CSV import ----------
const imp = await A.api("POST", "/api/import", { rows: [
  { date: "2026-09-02", amount: -120000, category: "Food", account: "HBL", note: "Imported lunch" },
  { date: "2026-09-03", amount: 5000000, type: "income", category: "Freelance", account: "Payoneer", note: "Client" },
] });
check(imp.status === 200, `CSV import (${JSON.stringify(imp.body).slice(0, 80)})`);

// ---------- Backup & restore round trip ----------
const backup = await A.page.evaluate(async () => (await fetch("/api/backup")).text());
const countBefore = (await A.api("GET", "/api/reports")).body.count;
const rs = await A.api("POST", "/api/restore", null, backup);
check(rs.status === 200, "restore from backup");
const countAfter = (await A.api("GET", "/api/reports")).body.count;
check(countAfter === countBefore, `same transaction count after restore (${countBefore} → ${countAfter})`);
check((await A.api("POST", "/api/restore", null, "{\"nope\":1}")).status === 400, "rejects a file that isn't a backup");

// ---------- PDF ----------
const pdf = await A.page.evaluate(async () => { const r = await fetch("/api/export?format=pdf"); const b = new Uint8Array(await r.arrayBuffer()); return [r.status, String.fromCharCode(...b.slice(0, 5)), b.length]; });
check(pdf[0] === 200 && pdf[1] === "%PDF-", `PDF report (${pdf[2]} bytes)`);
if (pdf[0] === 200) {
  const bytes = await A.page.evaluate(async () => Array.from(new Uint8Array(await (await fetch("/api/export?format=pdf")).arrayBuffer())));
  fs.writeFileSync(`${out}/report.pdf`, Buffer.from(bytes));
}

// ---------- Offline queue ----------
await A.page.goto(base + "/");
await A.page.waitForLoadState("networkidle");
await A.page.waitForTimeout(2500);
const n0 = (await A.api("GET", "/api/reports")).body.count;
await A.ctx.setOffline(true);
await A.page.evaluate(() => window.dispatchEvent(new Event("offline")));
await A.page.getByRole("button", { name: /add transaction/i }).first().click();
await A.page.waitForTimeout(600);
await shot(A.page, "07a-offline-sheet");
for (const k of ["3", "0", "0"]) await A.page.getByRole("button", { name: k, exact: true }).click();
await A.page.getByRole("button", { name: /save expense/i }).click();
await A.page.waitForTimeout(800);
await shot(A.page, "07-offline-saved");
await A.ctx.setOffline(false);
await A.page.evaluate(() => window.dispatchEvent(new Event("online")));
await A.page.waitForTimeout(2500);
const n1 = (await A.api("GET", "/api/reports")).body.count;
check(n1 === n0 + 1, `offline expense synced when back online (${n0} → ${n1})`);

// ---------- Worker: an overdue auto bill gets added ----------
const past = new Date(Date.now() - 2 * 864e5).toISOString();
const hblNow = (await A.api("GET", "/api/accounts")).body.accounts.find((a) => a.name === "HBL"); // ids change after a restore
const rec = (await A.api("POST", "/api/recurring", { type: "expense", name: "Gym", emoji: "🏋️", amount: 1000000, account: hblNow.id, category: null, frequency: "monthly", nextDate: past, mode: "auto" })).body;
check(!!rec.id, "created an overdue recurring bill");
fs.writeFileSync(`${out}/recurring-id.txt`, `${rec.id}\n${A.email}`);

await browser.close();
console.log(problems.length ? `\n${problems.length} problems:\n- ` + problems.join("\n- ") : "\nall checks passed");
