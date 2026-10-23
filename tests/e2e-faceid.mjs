// Face ID (passkey) unlock, using Chrome's virtual authenticator in place of the iPhone's Face ID.
// Usage: node tests/e2e-faceid.mjs http://localhost:3100
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:3100";
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
// An iPhone user agent, so the lock screen waits for a tap on "Unlock with Face ID" like it does on a real iPhone.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1" });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
const fails = [];
const check = (c, m) => { console.log(c ? "✓" : "✗", m); if (!c) fails.push(m); };
page.on("pageerror", (e) => fails.push("pageerror " + e.message));

await page.goto(base + "/login");
const api = (m, u, d) => page.evaluate(async ([m, u, d]) => { const r = await fetch(u, { method: m, headers: { "content-type": "application/json" }, body: d ? JSON.stringify(d) : undefined }); return r.status; }, [m, u, d]);
check((await api("POST", "/api/auth/signup", { name: "Face Test", email: `face${Date.now()}@example.com`, password: "correct horse 42" })) === 200, "sign up");
await api("POST", "/api/setup", { currency: "PKR", accounts: [{ name: "Cash", type: "cash" }] });
check((await api("POST", "/api/lock/pin", { pin: "1234" })) === 200, "set PIN");

await page.goto(base + "/settings/lock");
await page.waitForLoadState("networkidle");
for (const k of ["1", "2", "3", "4"]) await page.getByRole("button", { name: k, exact: true }).click();
await page.waitForTimeout(1200);
await page.getByRole("switch", { name: "Unlock with Face ID" }).click();
await page.waitForTimeout(2000);
const me = await page.evaluate(async () => (await (await fetch("/api/me")).json()).user.lock);
check(me.faceId === true, "Face ID turned on with a passkey");
await page.screenshot({ path: "/tmp/faceid-settings.png" });

// Reopen the app: it should be locked, then unlock with "Face ID".
await api("PATCH", "/api/me", { lock: { enabled: true, faceId: true, autoLockSec: 0 } }); // "Immediately"
await page.evaluate(() => sessionStorage.clear());
await page.goto(base + "/");
await page.waitForTimeout(1000);
check((await page.getByText("Pocket is locked").count()) > 0, "locked on open");
await page.screenshot({ path: "/tmp/faceid-lock.png" });
const faceBtn = page.getByRole("button", { name: /Unlock with Face ID/i });
if (await faceBtn.count()) await faceBtn.click();
await page.waitForTimeout(2000);
check((await page.getByText("Pocket is locked").count()) === 0, "Face ID unlocks the app");

await browser.close();
console.log(fails.length ? "\nFAILED:\n" + fails.join("\n") : "\nall checks passed");
