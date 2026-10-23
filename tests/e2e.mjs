// End-to-end run against a real server + MongoDB + Redis.
// Signs up through the UI, finishes setup, seeds data through the real API,
// exercises the main flows in the UI and screenshots every screen.
// Usage: node tests/e2e.mjs http://localhost:3100 out-dir
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] || "http://localhost:3100";
const out = process.argv[3] || "e2e-shots";
fs.mkdirSync(out, { recursive: true });
const errors = [];
const log = (...a) => console.log("•", ...a);

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: "Asia/Karachi", hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 4/.test(m.text())) errors.push(`console ${page.url()}: ${m.text()}`); });
page.on("response", (r) => { if (r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`); });

const shot = async (name) => { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/${name}.png` }); log("shot", name); };
const api = (method, url, data) => page.evaluate(async ([method, url, data]) => {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${t}`);
  return j;
}, [method, url, data]);

const email = `shahmir+${Date.now()}@example.com`;

// ---------- Sign up ----------
await page.goto(base + "/login");
await shot("01-login");
await page.goto(base + "/signup");
await page.getByLabel("Your name").fill("Shahmir Faisal");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password", { exact: true }).fill("correct horse 42");
await page.getByRole("checkbox").click();
await shot("02-signup");
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/setup/);
await shot("03-setup-currency");
await page.getByRole("button", { name: "Continue" }).click();
await shot("04-setup-accounts");
await page.getByRole("button", { name: "Continue" }).click();
await shot("05-setup-install");
await page.getByRole("button", { name: "Start using Pocket" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/setup"));
await shot("06-home-empty");

// ---------- Seed through the real API ----------
const { accounts } = await api("GET", "/api/accounts");
const { categories } = await api("GET", "/api/categories");
log("accounts", accounts.map((a) => a.name).join(", "), "| categories", categories.length);
const cat = (n) => categories.find((c) => c.name === n)?.id;
const acc = (n) => accounts.find((a) => a.name === n)?.id ?? accounts[0].id;
let hbl = accounts.find((a) => a.type === "bank");
if (!hbl) hbl = await api("POST", "/api/accounts", { name: "HBL", type: "bank", color: "#2F5BEA", startingBalance: 18695000 });
const jazz = (await api("POST", "/api/accounts", { name: "JazzCash", type: "wallet", color: "#C2335C", startingBalance: 385000 }));
const cash = accounts.find((a) => a.type === "cash") ?? accounts[0];
const day = (d, h = 13) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(h, 20, 0, 0); return x.toISOString(); };
const txs = [
  ["income", 18500000, "Salary", hbl.id, "Salary", 22],
  ["expense", 125000, "Food", cash.id, "Savour Foods", 0],
  ["expense", 64000, "Transport", jazz.id, "Careem", 0],
  ["expense", 843000, "Bills", hbl.id, "IESCO bill", 1],
  ["expense", 396900, "Shopping", hbl.id, "Daraz", 1],
  ["expense", 230000, "Fun", cash.id, "Cinepax", 2],
  ["expense", 432000, "Groceries", hbl.id, "Imtiaz", 3],
  ["expense", 245000, "Food", hbl.id, "Lunch at Kolachi", 4],
  ["expense", 300000, "Transport", cash.id, "Petrol", 6],
  ["expense", 180000, "Food", jazz.id, "Foodpanda", 9],
  ["expense", 520000, "Health", hbl.id, "Pharmacy", 12],
  ["expense", 610000, "Food", hbl.id, "Dinner", 35],
];
for (const [type, amount, c, a, note, d] of txs) {
  await api("POST", "/api/transactions", { type, amount, account: a, category: cat(c) ?? null, note, date: day(d), tags: note === "Lunch at Kolachi" ? ["work"] : [] });
}
await api("POST", "/api/transactions", { type: "transfer", amount: 1500000, account: hbl.id, toAccount: jazz.id, note: "Top up", date: day(1) });
await api("POST", "/api/transactions", { type: "expense", amount: 245000, account: hbl.id, category: cat("Food"), note: "Team lunch", date: day(0, 12), split: { people: [{ name: "Hamza", amount: 122500 }] } });
await api("POST", "/api/budgets", { category: null, amount: 9000000, period: "monthly" });
await api("POST", "/api/budgets", { category: cat("Food"), amount: 1500000, period: "monthly", alerts: [80, 100] });
await api("POST", "/api/budgets", { category: cat("Shopping"), amount: 300000, period: "monthly" });
const goal = (await api("POST", "/api/goals", { name: "New laptop", emoji: "💻", target: 40000000, targetDate: "2027-03-01", initial: 16000000 }));
const nextMonth = new Date(); nextMonth.setDate(nextMonth.getDate() + 1);
await api("POST", "/api/recurring", { type: "expense", name: "Netflix", emoji: "🎬", amount: 110000, account: hbl.id, category: cat("Fun"), frequency: "monthly", nextDate: nextMonth.toISOString(), mode: "ask", subscription: true });
await api("POST", "/api/recurring", { type: "income", name: "Salary", emoji: "💼", amount: 18500000, account: hbl.id, category: cat("Salary"), frequency: "monthly", nextDate: new Date(Date.now() + 9 * 864e5).toISOString(), mode: "auto" });
await api("POST", "/api/templates", { name: "Morning chai", emoji: "☕", amount: 12000, account: cash.id, category: cat("Food") });
log("seeded");

// ---------- Screens ----------
const routes = [
  ["07-home", "/"], ["08-activity", "/activity"], ["09-calendar", "/calendar"], ["10-insights", "/insights"],
  ["11-budgets", "/budgets"], ["12-goal", `/goals/${goal.id}`], ["13-wallets", "/wallets"], ["14-wallet-hbl", `/wallets/${hbl.id}`],
  ["15-recurring", "/recurring"], ["16-categories", "/categories"], ["17-category-food", `/categories/${cat("Food")}`],
  ["18-splits", "/splits"], ["19-notifications", "/notifications"], ["20-settings", "/settings"], ["21-lock-settings", "/settings/lock"],
  ["22-export", "/settings/export"], ["23-quick", "/quick"], ["24-scan", "/scan"],
];
for (const [name, path] of routes) {
  await page.goto(base + path);
  await page.waitForLoadState("networkidle");
  await shot(name);
}
const { transactions } = await api("GET", "/api/transactions");
await page.goto(base + `/transactions/${transactions.find((t) => t.note === "Team lunch").id}`);
await page.waitForLoadState("networkidle");
await shot("25-transaction");

// ---------- Flows in the UI ----------
// Add an expense from the + button with the keypad
await page.goto(base + "/");
await page.waitForLoadState("networkidle");
await page.getByRole("button", { name: /add transaction/i }).or(page.getByRole("link", { name: /add transaction/i })).first().click();
await page.waitForTimeout(600);
await shot("26-add-sheet");
for (const k of ["8", "5", "0"]) await page.getByRole("button", { name: k, exact: true }).click();
await shot("27-add-typed");
await page.getByRole("button", { name: /save expense/i }).click();
await page.waitForTimeout(1200);
await shot("28-after-save");

// Quick add with natural language
await page.goto(base + "/quick");
await page.waitForLoadState("networkidle");
const qa = page.getByRole("textbox").first();
await qa.fill("lunch 850 jazzcash");
await page.waitForTimeout(400);
await shot("29-quick-parsed");
await page.getByRole("button", { name: /add expense/i }).first().click();
await page.waitForTimeout(1200);
const after = await api("GET", "/api/transactions");
log("transactions now", after.transactions.length, after.transactions.slice(0, 2).map((t) => `${t.note}:${t.amount}:${t.account?.name}`).join(" | "));

// PIN lock: set a PIN via the API, lock, unlock with the keypad
await api("POST", "/api/lock/pin", { pin: "2580" }).catch((e) => errors.push("set pin: " + e.message));
await api("PATCH", "/api/me", { lock: { enabled: true, faceId: false, autoLockSec: 0 } }).catch((e) => errors.push("lock settings: " + e.message));

// Dark mode
await api("PATCH", "/api/me", { theme: "dark", lock: { enabled: false, faceId: false, autoLockSec: 60 } });
await page.goto(base + "/");
await page.waitForLoadState("networkidle");
await shot("30-home-dark");
await page.goto(base + "/insights");
await page.waitForLoadState("networkidle");
await shot("31-insights-dark");
await api("PATCH", "/api/me", { theme: "auto" });

// Exports
for (const f of ["csv", "xlsx"]) {
  const r = await page.evaluate(async (f) => { const r = await fetch(`/api/export?format=${f}`); return [r.status, r.headers.get("content-type"), (await r.arrayBuffer()).byteLength]; }, f);
  log("export", f, r.join(" "));
  if (r[0] !== 200) errors.push(`export ${f} ${r[0]}`);
}
const rep = await page.evaluate(async () => { const r = await fetch(`/api/reports`); return [r.status, r.headers.get("content-type"), (await r.arrayBuffer()).byteLength]; });
log("report", rep.join(" "));
const backup = await page.evaluate(async () => { const r = await fetch(`/api/backup`); return [r.status, (await r.text()).length]; });
log("backup", backup.join(" "));

// Logout & login again
await api("POST", "/api/auth/logout");
await page.goto(base + "/");
await page.waitForURL(/login/);
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password", { exact: true }).fill("correct horse 42");
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL((u) => u.pathname === "/");
log("login again ok");

await browser.close();
fs.writeFileSync(`${out}/errors.txt`, errors.join("\n"));
console.log(errors.length ? `\n${errors.length} problems:\n` + errors.join("\n") : "\nno errors");
