// Receipt scanning in the browser with the self-hosted Tesseract files.
// Usage: node tests/e2e-scan.mjs http://localhost:3100 /path/to/receipt.jpg
import { chromium } from "playwright";
const [base = "http://localhost:3100", img = "/tmp/receipt.jpg"] = process.argv.slice(2);
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const external = [];
page.on("request", (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.host !== new URL(base).host) external.push(r.url()); });
await page.goto(base + "/login");
await page.evaluate(async () => {
  await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Scan", email: `scan${Date.now()}@example.com`, password: "correct horse 42" }) });
  await fetch("/api/setup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ currency: "PKR", accounts: [{ name: "Cash", type: "cash" }] }) });
});
await page.goto(base + "/scan");
await page.waitForLoadState("networkidle");
await page.setInputFiles('input[type="file"]', img);
await page.getByText("Use these details").waitFor({ timeout: 90000 });
await page.screenshot({ path: "/tmp/scan-result.png" });
const text = await page.textContent("body");
console.log(/2,450/.test(text) ? "✓ total read as Rs 2,450" : "✗ total not found");
console.log(/kolachi/i.test(text) ? "✓ merchant read" : "✗ merchant not read");
console.log(external.length ? "✗ external requests: " + external.join(", ") : "✓ no third-party requests");
await page.getByText("Use these details").click();
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/scan-add.png" });
await browser.close();
