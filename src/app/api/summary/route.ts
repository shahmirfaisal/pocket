import { authed, ok } from "@/lib/api";
import { publicUser } from "@/lib/auth";
import { accountsWithBalances, spendingMatch, sumRange } from "@/lib/finance";
import { addDays, monthRange, weekRange } from "@/lib/dates";
import { serializeTx, TX_POPULATE } from "@/lib/serialize";
import { Notification, Transaction } from "@/models";

/** Everything the Home screen needs in one request. */
export const GET = authed(async ({ user }) => {
  const tz = user.timezone || "Asia/Karachi";
  const now = new Date();
  const accounts = await accountsWithBalances(user);
  const total = accounts.filter((a) => a.includeInTotal).reduce((s, a) => s + a.balance, 0);
  const m = monthRange(now, tz, user.monthStartDay ?? 1);
  const w = weekRange(now, tz, user.weekStartsOn ?? 1);
  const lw = weekRange(now, tz, user.weekStartsOn ?? 1, -1);
  const match = await spendingMatch(user);

  const [income, spent, lastWeek, week, recent, unread, count] = await Promise.all([
    sumRange(user, m.start, m.end, "income"),
    sumRange(user, m.start, m.end, "expense"),
    sumRange(user, lw.start, lw.end, "expense"),
    Transaction.find({ ...match, type: "expense", date: { $gte: w.start, $lt: w.end } }).select("amount date").lean(),
    Transaction.find({ $or: [match, { toAccount: match.account }] }).sort({ date: -1, _id: -1 }).limit(6).populate(TX_POPULATE).lean(),
    Notification.countDocuments({ user: user._id, read: false }),
    Transaction.countDocuments(match),
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const s = addDays(w.start, i, tz), e = addDays(w.start, i + 1, tz);
    return { date: s.toISOString(), total: week.filter((t) => t.date >= s && t.date < e).reduce((x, t) => x + t.amount, 0), future: s > now };
  });
  const weekTotal = days.reduce((s, d) => s + d.total, 0);

  return ok({
    user: publicUser(user),
    total,
    accountNames: accounts.filter((a) => a.includeInTotal).map((a) => a.name),
    month: { income, spent, start: m.start, end: m.end },
    week: { days, total: weekTotal, lastWeek },
    recent: recent.map((t) => serializeTx(t, String(user._id))),
    unread,
    hasTransactions: count > 0,
  });
});
