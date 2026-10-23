import "server-only";
import { Types } from "mongoose";
import { Account, Budget, Category, Transaction, type AccountDoc, type UserDoc } from "@/models";
import { periodRange } from "./dates";
import { notify } from "./notify";
import { formatMoney } from "./money";
import { HttpError } from "./auth";

const oid = (id: string | Types.ObjectId) => (typeof id === "string" ? new Types.ObjectId(id) : id);

/** Accounts the user owns or is an active member of. */
export async function accessibleAccounts(userId: string | Types.ObjectId, includeArchived = false) {
  const uid = oid(userId);
  const q: Record<string, unknown> = { $or: [{ owner: uid }, { members: { $elemMatch: { user: uid, status: "active" } } }] };
  if (!includeArchived) q.archived = false;
  return (await Account.find(q).sort({ order: 1, createdAt: 1 }).lean()) as AccountDoc[];
}

export async function accessibleAccountIds(userId: string | Types.ObjectId, includeArchived = true) {
  return (await accessibleAccounts(userId, includeArchived)).map((a) => a._id);
}

export async function assertAccount(userId: string | Types.ObjectId, accountId: string, { owner = false } = {}) {
  if (!Types.ObjectId.isValid(accountId)) throw new HttpError(404, "Account not found");
  const a = (await Account.findById(accountId).lean()) as AccountDoc | null;
  if (!a) throw new HttpError(404, "Account not found");
  const uid = String(userId);
  const isOwner = String(a.owner) === uid;
  const member = a.members?.find((m) => String(m.user) === uid && m.status === "active");
  if (!isOwner && (owner || !member || member.role === "viewer")) throw new HttpError(403, "You can't change this account");
  return a;
}

/** Current balance of each account, in minor units. */
export async function balances(accountIds: Types.ObjectId[], until?: Date) {
  const dateMatch = until ? { date: { $lt: until } } : {};
  const [out, inn] = await Promise.all([
    Transaction.aggregate<{ _id: { account: Types.ObjectId; type: string }; total: number }>([
      { $match: { account: { $in: accountIds }, ...dateMatch } },
      { $group: { _id: { account: "$account", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { type: "transfer", toAccount: { $in: accountIds }, ...dateMatch } },
      { $group: { _id: "$toAccount", total: { $sum: "$amount" } } },
    ]),
  ]);
  const map = new Map<string, number>();
  for (const r of out) {
    const k = String(r._id.account);
    map.set(k, (map.get(k) ?? 0) + (r._id.type === "income" ? r.total : -r.total));
  }
  for (const r of inn) map.set(String(r._id), (map.get(String(r._id)) ?? 0) + r.total);
  return map;
}

export function serializeAccount(a: AccountDoc, balance: number, userId: string) {
  return {
    id: String(a._id),
    name: a.name,
    type: a.type,
    currency: a.currency,
    color: a.color,
    startingBalance: a.startingBalance,
    balance: (a.startingBalance ?? 0) + balance,
    includeInTotal: a.includeInTotal,
    archived: a.archived,
    creditDueDay: a.creditDueDay ?? null,
    isOwner: String(a.owner) === userId,
    shared: (a.members?.length ?? 0) > 0,
    members: (a.members ?? []).map((m) => ({ id: String(m._id), email: m.email, name: m.name ?? null, user: m.user ? String(m.user) : null, role: m.role, status: m.status })),
  };
}
export type AccountJSON = ReturnType<typeof serializeAccount>;

export async function accountsWithBalances(user: UserDoc, includeArchived = false) {
  const accs = await accessibleAccounts(user._id, includeArchived);
  const bal = await balances(accs.map((a) => a._id));
  return accs.map((a) => serializeAccount(a, bal.get(String(a._id)) ?? 0, String(user._id)));
}

/** Transactions that count as "my spending": my own accounts, plus anything I created in shared ones. */
export async function spendingMatch(user: UserDoc) {
  const ids = await accessibleAccountIds(user._id);
  return { account: { $in: ids } };
}

export async function totalsByCategory(user: UserDoc, start: Date, end: Date, type: "expense" | "income" = "expense") {
  const match = await spendingMatch(user);
  return Transaction.aggregate<{ _id: Types.ObjectId | null; total: number; count: number }>([
    { $match: { ...match, type, date: { $gte: start, $lt: end } } },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);
}

export async function sumRange(user: UserDoc, start: Date, end: Date, type: "expense" | "income", category?: Types.ObjectId | null) {
  const match = await spendingMatch(user);
  const q: Record<string, unknown> = { ...match, type, date: { $gte: start, $lt: end } };
  if (category) q.category = category;
  const r = await Transaction.aggregate([{ $match: q }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
  return (r[0]?.total as number) ?? 0;
}

/** Spent amount and limit for a budget in the period containing `at`, including rollover. */
export async function budgetProgress(user: UserDoc, b: { _id: Types.ObjectId; category?: Types.ObjectId | null; amount: number; period: string; rollover?: boolean }, at = new Date()) {
  const tz = user.timezone || "Asia/Karachi";
  const period = b.period as "weekly" | "monthly" | "yearly";
  const r = periodRange(period, at, tz, user.monthStartDay ?? 1, user.weekStartsOn ?? 1);
  const spent = await sumRange(user, r.start, r.end, "expense", b.category ?? null);
  let limit = b.amount;
  if (b.rollover) {
    const prev = periodRange(period, at, tz, user.monthStartDay ?? 1, user.weekStartsOn ?? 1, -1);
    const prevSpent = await sumRange(user, prev.start, prev.end, "expense", b.category ?? null);
    limit += Math.max(0, b.amount - prevSpent);
  }
  return { spent, limit, range: r };
}

/** Send budget threshold alerts that have been crossed and not yet sent this period. */
export async function checkBudgets(user: UserDoc) {
  if (user.alerts === false) return;
  const budgets = await Budget.find({ user: user._id });
  for (const b of budgets) {
    const { spent, limit, range } = await budgetProgress(user, b);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const state = b.alertState?.periodKey === range.key ? b.alertState : { periodKey: range.key, sent: [] as number[] };
    const crossed = (b.alerts ?? []).filter((t) => pct >= t && !(state.sent ?? []).includes(t)).sort((a, c) => c - a);
    if (!crossed.length) {
      if (b.alertState?.periodKey !== range.key) { b.alertState = state; await b.save(); }
      continue;
    }
    const top = crossed[0];
    const cat = b.category ? await Category.findById(b.category).lean() : null;
    const name = cat ? `${cat.name} budget` : "Your budget";
    const left = limit - spent;
    await notify(String(user._id), {
      kind: "budget",
      title: top >= 100 ? `${name} is used up` : `${name} at ${Math.round(pct)}%`,
      body: left >= 0 ? `${formatMoney(left, user.currency)} left this ${b.period.replace("ly", "")}.` : `${formatMoney(-left, user.currency)} over this ${b.period.replace("ly", "")}.`,
      link: cat ? `/categories/${cat._id}` : "/budgets",
    });
    b.alertState = { periodKey: range.key, sent: [...(state.sent ?? []), ...crossed] };
    await b.save();
  }
}
