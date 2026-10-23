import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { PERSON_COLORS } from "@/lib/defaults";
import { Debt, Person } from "@/models";

/** Everyone you split with, with their running balance, plus recent splits. */
export const GET = authed(async ({ user }) => {
  const [people, open, recent] = await Promise.all([
    Person.find({ user: user._id }).sort({ name: 1 }).lean(),
    Debt.aggregate([{ $match: { user: user._id, settled: false } }, { $group: { _id: "$person", total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
    Debt.find({ user: user._id }).sort({ date: -1 }).limit(20).populate<{ person: { _id: unknown; name: string } }>("person", "name").populate<{ transaction: { _id: unknown; amount: number; note: string; category?: unknown } | null }>("transaction", "amount note").lean(),
  ]);
  const rows = people.map((p) => {
    const o = open.find((x) => String(x._id) === String(p._id));
    return { id: String(p._id), name: p.name, color: p.color, balance: o?.total ?? 0, open: o?.count ?? 0 };
  });
  return ok({
    owed: rows.filter((r) => r.balance > 0).reduce((s, r) => s + r.balance, 0),
    owe: -rows.filter((r) => r.balance < 0).reduce((s, r) => s + r.balance, 0),
    people: rows.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
    recent: recent.map((d) => ({
      id: String(d._id), amount: d.amount, note: d.note, date: d.date, settled: d.settled,
      person: { id: String(d.person?._id), name: d.person?.name ?? "" },
      transaction: d.transaction ? { id: String(d.transaction._id), amount: d.transaction.amount, note: d.transaction.note } : null,
    })),
  });
});

export const POST = authed(async ({ req, user }) => {
  const { name } = await body(req, z.object({ name: z.string().trim().min(1).max(40) }));
  const count = await Person.countDocuments({ user: user._id });
  const p = await Person.create({ user: user._id, name, color: PERSON_COLORS[count % PERSON_COLORS.length] });
  return ok({ id: String(p._id) }, { status: 201 });
});
