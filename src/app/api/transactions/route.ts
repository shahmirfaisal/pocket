import { Types } from "mongoose";
import { authed, body, ok } from "@/lib/api";
import { txInput } from "@/lib/schemas";
import { accessibleAccountIds } from "@/lib/finance";
import { createTransaction } from "@/lib/transactions";
import { serializeTx, TX_POPULATE } from "@/lib/serialize";
import { Transaction } from "@/models";

const isId = (s: string) => Types.ObjectId.isValid(s) && /^[a-f\d]{24}$/i.test(s);

/**
 * GET /api/transactions?type=expense&category=a,b&account=x&from=ISO&to=ISO&q=text&min=100&max=900&cursor=ISO_id&limit=50
 */
export const GET = authed(async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const ids = await accessibleAccountIds(user._id);
  const accFilter = (sp.get("account") || "").split(",").filter(isId);
  const allowed = accFilter.length ? ids.filter((i) => accFilter.includes(String(i))) : ids;
  const q: Record<string, unknown> = { $or: [{ account: { $in: allowed } }, { toAccount: { $in: allowed } }] };
  const type = sp.get("type");
  if (type === "expense" || type === "income" || type === "transfer") q.type = type;
  const cats = (sp.get("category") || "").split(",").filter(isId);
  if (cats.length) q.category = { $in: cats.map((c) => new Types.ObjectId(c)) };
  const sub = sp.get("subcategory");
  if (sub) q.subcategory = sub;
  const from = sp.get("from"), to = sp.get("to");
  const date: Record<string, Date> = {};
  if (from && !isNaN(Date.parse(from))) date.$gte = new Date(from);
  if (to && !isNaN(Date.parse(to))) date.$lt = new Date(to);
  const min = Number(sp.get("min")), max = Number(sp.get("max"));
  const amount: Record<string, number> = {};
  if (min > 0) amount.$gte = min;
  if (max > 0) amount.$lte = max;
  if (Object.keys(amount).length) q.amount = amount;
  const text = (sp.get("q") || "").trim();
  const and: Record<string, unknown>[] = [];
  if (text) {
    const rx = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const or: Record<string, unknown>[] = [{ note: rx }, { tags: rx }, { subcategory: rx }];
    const num = Number(text.replace(/,/g, ""));
    if (num > 0) or.push({ amount: Math.round(num * 100) });
    and.push({ $or: or });
  }
  if (sp.get("recurring") === "1") q.recurring = { $exists: true };
  if (Object.keys(date).length) q.date = date;
  const base = and.length ? { ...q, $and: and } : q;

  let pageQuery: Record<string, unknown> = base;
  const cursor = sp.get("cursor");
  if (cursor) {
    const [iso, id] = cursor.split("_");
    const cd = new Date(iso);
    if (!isNaN(cd.getTime()) && isId(id)) {
      pageQuery = { ...q, $and: [...and, { $or: [{ date: { $lt: cd } }, { date: cd, _id: { $lt: new Types.ObjectId(id) } }] }] };
    }
  }

  const limit = Math.min(200, Math.max(1, Number(sp.get("limit")) || 50));
  const rows = await Transaction.find(pageQuery).sort({ date: -1, _id: -1 }).limit(limit + 1).populate(TX_POPULATE).lean();
  const more = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];

  let totals: { expense: number; income: number; count: number } | undefined;
  if (!cursor) {
    const agg = await Transaction.aggregate<{ _id: string; total: number; count: number }>([
      { $match: base },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    const by = (t: string) => agg.find((g) => g._id === t)?.total ?? 0;
    totals = { expense: by("expense"), income: by("income"), count: agg.reduce((n, g) => n + g.count, 0) };
  }

  return ok({
    transactions: page.map((t) => serializeTx(t, String(user._id))),
    next: more && last ? `${last.date.toISOString()}_${last._id}` : null,
    totals,
  });
});

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, txInput);
  const tx = await createTransaction(user, input);
  const full = await Transaction.findById(tx._id).populate(TX_POPULATE).lean();
  return ok({ transaction: serializeTx(full!, String(user._id)) }, { status: 201 });
});
