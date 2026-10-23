import { authed, body, ok } from "@/lib/api";
import { budgetProgress, spendingMatch } from "@/lib/finance";
import { monthRange, partsIn, MONTHS } from "@/lib/dates";
import { serializeCategory } from "@/lib/serialize";
import { HttpError } from "@/lib/auth";
import { categoryInput } from "@/lib/schemas";
import { Types } from "mongoose";
import { Budget, Category, Recurring, Template, Transaction } from "@/models";

async function own(userId: Types.ObjectId, id: string) {
  const c = await Category.findOne({ _id: id, user: userId });
  if (!c) throw new HttpError(404, "Category not found");
  return c;
}

/** Category detail: this month, trend, subcategories, top places, budget. */
export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const c = await own(user._id, params.id);
  const tz = user.timezone || "Asia/Karachi";
  const match = await spendingMatch(user);
  const type = c.type === "income" ? "income" : "expense";
  const cur = monthRange(new Date(), tz, user.monthStartDay ?? 1);
  const prev = monthRange(new Date(), tz, user.monthStartDay ?? 1, -1);
  const sum = async (start: Date, end: Date) =>
    (await Transaction.aggregate([{ $match: { ...match, type, category: c._id, date: { $gte: start, $lt: end } } }, { $group: { _id: null, t: { $sum: "$amount" } } }]))[0]?.t ?? 0;
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const r = monthRange(new Date(), tz, user.monthStartDay ?? 1, -i);
    trend.push({ label: MONTHS[partsIn(r.start, tz).m - 1], total: await sum(r.start, r.end), current: i === 0 });
  }
  const base = { ...match, type, category: c._id, date: { $gte: cur.start, $lt: cur.end } };
  const [subs, places] = await Promise.all([
    Transaction.aggregate([{ $match: base }, { $group: { _id: "$subcategory", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Transaction.aggregate<{ _id: string; total: number; count: number }>([{ $match: { ...base, note: { $gt: "" } } }, { $group: { _id: "$note", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
  ]);
  const budget = await Budget.findOne({ user: user._id, category: c._id, period: "monthly" }).lean();
  const progress = budget ? await budgetProgress(user, budget) : null;
  return ok({
    category: serializeCategory(c.toObject()),
    month: { total: trend[5].total, prev: await sum(prev.start, prev.end), start: cur.start, end: cur.end },
    trend,
    subcategories: subs.map((x) => ({ name: x._id ?? "Other", total: x.total, count: x.count })),
    places: mergePlaces(places),
    budget: budget && progress ? { id: String(budget._id), spent: progress.spent, limit: progress.limit } : null,
  });
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const c = await own(user._id, params.id);
  const input = await body(req, categoryInput.partial());
  const removed = input.subcategories ? (c.subcategories ?? []).filter((s) => !input.subcategories!.includes(s)) : [];
  Object.assign(c, input);
  await c.save();
  if (removed.length) await Transaction.updateMany({ category: c._id, subcategory: { $in: removed } }, { $unset: { subcategory: 1 } });
  return ok({ ok: true });
});

/** Deleting moves its transactions to "Other" (or "Other income") so nothing is lost. */
export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const c = await own(user._id, params.id);
  const fallbackName = c.type === "income" ? "Other income" : "Other";
  if (c.name === fallbackName) throw new HttpError(400, `"${fallbackName}" can't be deleted`);
  let fallback = await Category.findOne({ user: user._id, name: fallbackName, type: c.type });
  if (!fallback) fallback = await Category.create({ user: user._id, name: fallbackName, emoji: "✨", color: "#F1F2F4", type: c.type, order: 999 });
  await Transaction.updateMany({ category: c._id }, { $set: { category: fallback._id }, $unset: { subcategory: 1 } });
  await Recurring.updateMany({ category: c._id }, { $set: { category: fallback._id } });
  await Template.updateMany({ category: c._id }, { $set: { category: fallback._id } });
  await Budget.deleteMany({ category: c._id });
  await c.deleteOne();
  return ok({ ok: true });
});

function mergePlaces(rows: { _id: string; total: number; count: number }[]) {
  const m = new Map<string, { name: string; total: number; count: number }>();
  for (const r of rows) {
    const k = r._id.trim().toLowerCase();
    const v = m.get(k) ?? { name: r._id.trim(), total: 0, count: 0 };
    v.total += r.total; v.count += r.count;
    m.set(k, v);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 5);
}
