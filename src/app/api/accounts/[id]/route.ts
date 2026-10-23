import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { accountInput } from "@/lib/schemas";
import { assertAccount, balances, serializeAccount } from "@/lib/finance";
import { addDays, startOfDay, monthRange } from "@/lib/dates";
import { Account, Recurring, Transaction, User } from "@/models";
import { Types } from "mongoose";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const a = await Account.findById(params.id).lean();
  const uid = String(user._id);
  if (!a || (String(a.owner) !== uid && !a.members?.some((m) => String(m.user) === uid && m.status === "active"))) throw new HttpError(404, "Account not found");
  const tz = user.timezone || "Asia/Karachi";
  const bal = (await balances([a._id])).get(String(a._id)) ?? 0;
  const acc = serializeAccount(a, bal, uid);

  // Daily balance for the last 30 days
  const today = startOfDay(new Date(), tz);
  const from = addDays(today, -29, tz);
  const before = (await balances([a._id], from)).get(String(a._id)) ?? 0;
  const txs = await Transaction.find({ $or: [{ account: a._id }, { toAccount: a._id }], date: { $gte: from } }).select("type amount account toAccount date").lean();
  const series: number[] = [];
  let running = (a.startingBalance ?? 0) + before;
  for (let i = 0; i < 30; i++) {
    const s = addDays(from, i, tz), e = addDays(from, i + 1, tz);
    for (const t of txs) {
      if (t.date < s || t.date >= e) continue;
      const out = String(t.account) === String(a._id);
      if (t.type === "income") running += t.amount;
      else if (t.type === "expense") running -= t.amount;
      else running += out ? -t.amount : t.amount;
    }
    series.push(running);
  }

  const m = monthRange(new Date(), tz, user.monthStartDay ?? 1);
  const monthTx = await Transaction.find({ $or: [{ account: a._id }, { toAccount: a._id }], date: { $gte: m.start, $lt: m.end } }).select("type amount account toAccount").lean();
  const self = String(a._id);
  const monthIn = monthTx.filter((t) => t.type === "income" || (t.type === "transfer" && String(t.toAccount) === self)).reduce((x, t) => x + t.amount, 0);
  const monthOut = monthTx.filter((t) => t.type === "expense" || (t.type === "transfer" && String(t.account) === self)).reduce((x, t) => x + t.amount, 0);


  // Member spending this month (for shared wallets)
  let members: { user: string; name: string; spent: number }[] = [];
  if (acc.shared) {
    const agg = await Transaction.aggregate([
      { $match: { account: a._id, type: "expense", date: { $gte: m.start, $lt: m.end } } },
      { $group: { _id: "$user", spent: { $sum: "$amount" } } },
    ]);
    const ids = [a.owner, ...(a.members ?? []).filter((x) => x.user && x.status === "active").map((x) => x.user as Types.ObjectId)];
    const users = await User.find({ _id: { $in: ids } }).select("name").lean();
    members = ids.map((id) => ({
      user: String(id),
      name: users.find((u) => String(u._id) === String(id))?.name ?? "Member",
      spent: agg.find((g) => String(g._id) === String(id))?.spent ?? 0,
    }));
  }
  const owner = await User.findById(a.owner).select("name email").lean();

  return ok({
    account: acc,
    owner: { id: String(a.owner), name: owner?.name ?? "", email: owner?.email ?? "" },
    series,
    month: { in: monthIn, out: monthOut },
    members,
  });
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  await assertAccount(user._id, params.id, { owner: true });
  const input = await body(req, accountInput.partial().extend({ archived: z.boolean().optional(), order: z.number().int().optional() }));
  await Account.updateOne({ _id: params.id }, { $set: input });
  return ok({ ok: true });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await assertAccount(user._id, params.id, { owner: true });
  const id = new Types.ObjectId(params.id);
  await Transaction.deleteMany({ $or: [{ account: id }, { toAccount: id }] });
  await Recurring.deleteMany({ account: id });
  await Account.deleteOne({ _id: id });
  await User.updateMany({ defaultAccount: id }, { $unset: { defaultAccount: 1 } });
  return ok({ ok: true });
});
