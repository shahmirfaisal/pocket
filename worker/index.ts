/**
 * Background worker: recurring transactions, bill reminders and the daily
 * "log your spending" nudge. Runs every 5 minutes via a BullMQ repeatable job.
 *
 *   npm run worker
 */
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { Recurring, Transaction, User, type UserDoc } from "@/models";
import { runRecurring } from "@/lib/recurring";
import { notify } from "@/lib/notify";
import { addDays, dayKey, partsIn, startOfDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { accessibleAccountIds } from "@/lib/finance";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
const QUEUE = "pocket";

async function processRecurring() {
  const now = new Date();
  const due = await Recurring.find({ paused: false, nextDate: { $lte: now } }).limit(500);
  for (const r of due) {
    const user = (await User.findById(r.user).lean()) as UserDoc | null;
    if (!user) continue;
    try {
      if (r.mode === "auto") {
        // Catch up on missed occurrences (e.g. worker was down), at most a year of them.
        for (let i = 0; i < 366 && r.nextDate <= now && !r.paused; i++) await runRecurring(user, r);
      } else if (!r.remindedFor || r.remindedFor.getTime() !== r.nextDate.getTime()) {
        await notify(String(user._id), {
          kind: "recurring",
          title: `${r.name} is due`,
          body: `${formatMoney(r.amount, user.currency)} — tap to add it.`,
          link: `/recurring?due=${r._id}`,
        });
        r.remindedFor = r.nextDate;
        await r.save();
      }
    } catch (e) {
      console.error("[worker] recurring", String(r._id), e);
    }
  }
}

async function upcomingReminders() {
  // Tell people the day before a subscription or bill is taken.
  const now = new Date();
  const soon = await Recurring.find({ paused: false, type: "expense", nextDate: { $gt: now, $lte: new Date(now.getTime() + 36 * 3600 * 1000) } }).populate<{ account: { name: string } }>("account", "name").limit(1000);
  for (const r of soon) {
    const user = (await User.findById(r.user).lean()) as UserDoc | null;
    if (!user || user.alerts === false) continue;
    const tz = user.timezone || "Asia/Karachi";
    const tomorrow = dayKey(addDays(now, 1, tz), tz);
    if (dayKey(r.nextDate, tz) !== tomorrow) continue;
    if (partsIn(now, tz).h < 9) continue; // don't ping before 9am
    const key = `upcoming:${r._id}:${tomorrow}`;
    if (!(await redis.set(key, "1", "EX", 3 * 86400, "NX"))) continue;
    await notify(String(user._id), {
      kind: "recurring",
      title: `${r.name} ${r.subscription ? "renews" : "is due"} tomorrow`,
      body: `${formatMoney(r.amount, user.currency)} from ${r.account?.name ?? "your account"}.`,
      link: "/recurring",
    });
  }
}

async function dailyReminders() {
  const now = new Date();
  const users = await User.find({ "reminder.enabled": true }).lean();
  for (const u of users as UserDoc[]) {
    const tz = u.timezone || "Asia/Karachi";
    const p = partsIn(now, tz);
    const [h, m] = (u.reminder?.time || "21:00").split(":").map(Number);
    const minutesNow = p.h * 60 + p.min, target = h * 60 + m;
    if (minutesNow < target || minutesNow > target + 30) continue;
    const key = `remind:${u._id}:${dayKey(now, tz)}`;
    if (!(await redis.set(key, "1", "EX", 2 * 86400, "NX"))) continue;
    const ids = await accessibleAccountIds(u._id);
    const today = await Transaction.countDocuments({ account: { $in: ids }, user: u._id, date: { $gte: startOfDay(now, tz) } });
    await notify(String(u._id), {
      kind: "reminder",
      title: today ? "Anything else today?" : "Log today's spending",
      body: today ? `You've added ${today} ${today === 1 ? "transaction" : "transactions"} today.` : "It takes a few seconds — tap to add.",
      link: "/quick",
      push: true,
    });
  }
}

async function tick() {
  await db();
  await processRecurring();
  await upcomingReminders();
  await dailyReminders();
}

async function main() {
  await db();
  const queue = new Queue(QUEUE, { connection });
  await queue.upsertJobScheduler("tick", { every: 5 * 60 * 1000 }, { name: "tick" });
  new Worker(
    QUEUE,
    async (job) => {
      if (job.name === "tick") await tick();
    },
    { connection, concurrency: 1 }
  ).on("failed", (job, err) => console.error("[worker] job failed", job?.name, err));
  console.log("[worker] running — checking every 5 minutes");
  await tick();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
