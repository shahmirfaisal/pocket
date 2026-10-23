# Pocket

An expense tracker that installs on your iPhone's Home Screen and feels like a native app. Self-hosted on your own server.

## Features

- **Accounts & wallets** — cash, bank, mobile wallets, credit cards, savings, loans; transfers between them; net worth.
- **Transactions** — expenses, income and transfers with categories, subcategories, notes, tags, receipt photos and splits. Search, filters and a spending calendar.
- **Quick add** — type `lunch 850 jazzcash` or `salary +185000 hbl yesterday`, or tap a saved template.
- **Receipt scanning** — on-device OCR (Tesseract) reads the shop, total and date. Photos never leave your server.
- **Budgets & goals** — monthly/weekly/yearly budgets per category with alerts and rollover; savings goals with milestones.
- **Insights** — spending by category, trends, month-over-month changes and a PDF monthly report.
- **Recurring** — bills, subscriptions and salary added automatically (or after asking you), with reminders the day before.
- **Shared wallets** — invite family by email to track a wallet together. **Split bills** — track who owes whom and settle up.
- **Notifications** — in-app and push: budget alerts, bills due, goal milestones and a daily "log your spending" nudge.
- **App lock** — Face ID (a passkey stored on the phone) with a PIN fallback; auto-lock after leaving the app; hide amounts.
- **Your data** — export CSV, Excel or PDF; import from CSV; full JSON backup and restore.
- **Works offline** — expenses added without signal are saved on the phone and synced when you're back online.
- Light and dark mode, PKR by default with other currencies available.

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · MongoDB (Mongoose) · Redis (sessions, rate limits, BullMQ jobs) · TanStack Query · Vaul / Motion · SimpleWebAuthn · web-push · Tesseract.js · ExcelJS / PapaParse / React-PDF · Docker Compose + Caddy.

Amounts are stored as whole paisa (integers) so totals never drift.

## Run it locally

You need Node.js 22+ and Docker.

```bash
npm install
docker compose -f docker-compose.dev.yml up -d   # MongoDB + Redis on localhost
cp .env.example .env.local
```

In `.env.local` set:

```
APP_URL=http://localhost:3000
APP_DOMAIN=localhost
MONGODB_URI=mongodb://localhost:27017/pocket
REDIS_URL=redis://localhost:6379
UPLOAD_DIR=./data/uploads
```

Then:

```bash
npm run dev       # the app on http://localhost:3000
npm run worker    # recurring transactions and reminders (second terminal)
```

Without `SMTP_PASS`, emails (password reset, invites) are printed in the terminal instead of being sent.

## Deploy on your VPS

1. Point a DNS record (for example `pocket.shahmirfaisal.com`) at the server.
2. Copy the project to the server and create `.env` from `.env.example`:
   - `APP_URL` / `APP_DOMAIN` — your domain.
   - `SMTP_PASS` — a Zoho **app-specific password** for me@shahmirfaisal.com (Zoho Mail → Settings → Security → App passwords). Use `smtppro.zoho.com` if you're on a paid Zoho plan, or `smtp.zoho.eu` / `smtp.zoho.in` if your Zoho account is in that region.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — run `npx web-push generate-vapid-keys`. Generate them once and keep them; changing them signs every phone out of push notifications.
3. Start everything:

   ```bash
   docker compose up -d --build
   ```

   Caddy gets the HTTPS certificate automatically. HTTPS is required for Face ID and push notifications.
4. On your iPhone, open the site in Safari → Share → **Add to Home Screen**, open Pocket from the Home Screen, then turn on notifications in Settings.

MongoDB and Redis are only reachable from the app containers — they aren't published to the internet.

### Update

```bash
git pull   # or copy the new files
docker compose up -d --build
```

### Back up the database

```bash
docker compose exec -T mongo mongodump --archive --gzip --db pocket > pocket-$(date +%F).archive.gz
# restore:
docker compose exec -T mongo mongorestore --archive --gzip --drop < pocket-2026-10-23.archive.gz
```

Receipt photos live in the `uploads` Docker volume. Each person can also download their own full backup from **Settings → Export & backup**.

## Tests

```bash
npm test                 # unit tests: money, dates, quick add parser, receipt parser
npm run typecheck
```

End-to-end checks run against a real server (`npm run build` and start it, plus MongoDB and Redis):

```bash
node tests/e2e.mjs http://localhost:3000 shots              # sign-up, setup, every screen, main flows
node tests/e2e-more.mjs http://localhost:3000 shots2 server.log   # lock, password reset, sharing, import, backup, offline
node tests/e2e-faceid.mjs http://localhost:3000             # Face ID with a virtual authenticator
node tests/e2e-scan.mjs http://localhost:3000 receipt.jpg   # receipt OCR
```

## Notes

- **App lock is a privacy lock**, not encryption: it stops someone who picks up your unlocked phone from opening Pocket. Forgot your PIN? Sign in again with your password, which clears it.
- **Face ID** uses a passkey created on the phone. It works in the installed Home Screen app on iOS 16+ over HTTPS. The lock screen shows a button because iOS only allows Face ID after a tap.
- **Push notifications on iPhone** need iOS 16.4+ and Pocket installed to the Home Screen.
