import { Types } from "mongoose";
import { authed, ok } from "@/lib/api";
import { periodRange, partsIn, MONTHS, dayKey } from "@/lib/dates";
import { spendingMatch, totalsByCategory } from "@/lib/finance";
import { Category, Transaction } from "@/models";
import { formatMoney } from "@/lib/money";

type Period = "weekly" | "monthly" | "yearly";

export const GET = authed(async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const p = sp.get("period");
  const period: Period = p === "week" ? "weekly" : p === "year" ? "yearly" : "monthly";
  const offset = Math.min(0, Math.max(-120, Number(sp.get("offset")) || 0));
  const tz = user.timezone || "Asia/Karachi";
  const now = new Date();
  const range = (o: number) => periodRange(period, now, tz, user.monthStartDay ?? 1, user.weekStartsOn ?? 1, o);
  const cur = range(offset), prev = range(offset - 1);

  const [byCat, prevByCat, cats] = await Promise.all([
    totalsByCategory(user, cur.start, cur.end),
    totalsByCategory(user, prev.start, prev.end),
    Category.find({ user: user._id }).lean(),
  ]);
  const catMap = new Map(cats.map((c) => [String(c._id), c]));
  const spent = byCat.reduce((s, c) => s + c.total, 0);
  const prevSpent = prevByCat.reduce((s, c) => s + c.total, 0);

  const match = await spendingMatch(user);
  const incomeAgg = await Transaction.aggregate([{ $match: { ...match, type: "income", date: { $gte: cur.start, $lt: cur.end } } }, { $group: { _id: null, t: { $sum: "$amount" } } }]);

  // Trend: previous 6 periods
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const r = range(offset - i);
    const agg = await Transaction.aggregate([{ $match: { ...match, type: "expense", date: { $gte: r.start, $lt: r.end } } }, { $group: { _id: null, t: { $sum: "$amount" } } }]);
    const sp2 = partsIn(r.start, tz);
    trend.push({ label: period === "monthly" ? MONTHS[sp2.m - 1] : period === "yearly" ? String(sp2.y) : `${sp2.d} ${MONTHS[sp2.m - 1]}`, total: agg[0]?.t ?? 0, current: i === 0 });
  }

  // The most notable change vs the previous period
  let insight: { title: string; body: string; categoryId: string } | null = null;
  let best = 0;
  for (const c of byCat) {
    if (!c._id) continue;
    const before = prevByCat.find((x) => String(x._id) === String(c._id))?.total ?? 0;
    const diff = c.total - before;
    if (before > 0 && diff > best && diff / before >= 0.1) {
      best = diff;
      const cat = catMap.get(String(c._id));
      const subs = await Transaction.aggregate([
        { $match: { ...match, type: "expense", category: new Types.ObjectId(String(c._id)), date: { $gte: cur.start, $lt: cur.end }, subcategory: { $exists: true, $ne: null } } },
        { $group: { _id: "$subcategory", t: { $sum: "$amount" } } }, { $sort: { t: -1 } }, { $limit: 1 },
      ]);
      const word = period === "weekly" ? "last week" : period === "yearly" ? "last year" : `last month`;
      insight = {
        title: `${cat?.name ?? "Spending"} is up ${Math.round((diff / before) * 100)}% vs ${word}`,
        body: subs[0] ? `Mostly ${String(subs[0]._id).toLowerCase()} — ${formatMoney(diff, user.currency)} more than ${word}.` : `${formatMoney(diff, user.currency)} more than ${word}.`,
        categoryId: String(c._id),
      };
    }
  }

  const days = Math.max(1, Math.round((Math.min(now.getTime(), cur.end.getTime()) - cur.start.getTime()) / 86400000));
  return ok({
    range: { start: cur.start, end: cur.end, key: cur.key, label: dayKey(cur.start, tz) },
    spent,
    prevSpent,
    income: incomeAgg[0]?.t ?? 0,
    dailyAverage: Math.round(spent / days),
    categories: byCat.map((c) => {
      const cat = c._id ? catMap.get(String(c._id)) : null;
      return { id: c._id ? String(c._id) : null, name: cat?.name ?? "Uncategorised", emoji: cat?.emoji ?? "🏷️", color: cat?.color ?? "#F1F2F4", total: c.total, count: c.count };
    }),
    trend,
    insight,
  });
});
