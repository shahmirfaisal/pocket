import { authed, ok } from "@/lib/api";
import { addDays, dayKey, partsIn, zoned } from "@/lib/dates";
import { spendingMatch } from "@/lib/finance";
import { Transaction } from "@/models";

/** GET /api/calendar?month=2026-10 → spending per day */
export const GET = authed(async ({ req, user }) => {
  const tz = user.timezone || "Asia/Karachi";
  const now = partsIn(new Date(), tz);
  const [y, m] = (req.nextUrl.searchParams.get("month") || `${now.y}-${now.m}`).split("-").map(Number);
  const start = zoned(y, m, 1, tz);
  const end = zoned(y, m + 1, 1, tz);
  const match = await spendingMatch(user);
  const txs = await Transaction.find({ ...match, type: { $in: ["expense", "income"] }, date: { $gte: start, $lt: end } }).select("type amount date").lean();
  const days: Record<string, { spent: number; income: number }> = {};
  for (let d = start; d < end; d = addDays(d, 1, tz)) days[dayKey(d, tz)] = { spent: 0, income: 0 };
  for (const t of txs) {
    const k = dayKey(t.date, tz);
    if (!days[k]) continue;
    if (t.type === "expense") days[k].spent += t.amount;
    else days[k].income += t.amount;
  }
  return ok({ year: y, month: m, firstWeekday: partsIn(start, tz).wd, days, today: dayKey(new Date(), tz) });
});
