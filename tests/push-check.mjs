// Checks that Pocket sends a real Web Push request (VAPID-signed, encrypted) when a notification fires.
// Usage: KEY=key.pem CERT=cert.pem node tests/push-check.mjs http://127.0.0.1:3100
// (run the server with NODE_TLS_REJECT_UNAUTHORIZED=0 so it accepts the self-signed test endpoint)
import https from "node:https";
import fs from "node:fs";
import crypto from "node:crypto";
const base = process.argv[2] || "http://127.0.0.1:3100";
const got = [];
const srv = https.createServer({ key: fs.readFileSync(process.env.KEY), cert: fs.readFileSync(process.env.CERT) }, (req, res) => { let n = 0; req.on("data", (c) => (n += c.length)); req.on("end", () => { got.push({ headers: req.headers, bytes: n }); res.writeHead(201).end(); }); }).listen(9999);

let cookie = "";
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { "content-type": "application/json", cookie, origin: base }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  return [r.status, await r.json().catch(() => null)];
};
await call("POST", "/api/auth/signup", { name: "Push", email: `push${Date.now()}@example.com`, password: "correct horse 42" });
await call("POST", "/api/setup", { currency: "PKR", accounts: [{ name: "Cash", type: "cash" }] });
const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
const sub = { endpoint: "https://127.0.0.1:9999/push/abc", keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") } };
console.log("subscribe", (await call("POST", "/api/push", sub))[0]);
const [, g] = await call("POST", "/api/goals", { name: "Test", target: 100000, initial: 0 });
console.log("contribute", (await call("POST", `/api/goals/${g.id}/contribute`, { amount: 60000 }))[0]);
await new Promise((r) => setTimeout(r, 1500));
srv.close();
const p = got[0];
console.log(p ? `✓ push delivered: ${p.bytes} encrypted bytes, encoding=${p.headers["content-encoding"]}, vapid=${/^vapid t=/.test(p.headers.authorization || "")}` : "✗ no push received");
