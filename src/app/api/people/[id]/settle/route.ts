import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { objectId } from "@/lib/schemas";
import { createTransaction } from "@/lib/transactions";
import { Category, Debt, Person } from "@/models";

/** Settle everything with a person. Optionally record the money moving in an account. */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const { account } = await body(req, z.object({ account: objectId.nullable().optional() }));
  const person = await Person.findOne({ _id: params.id, user: user._id }).lean();
  if (!person) throw new HttpError(404, "Person not found");
  const open = await Debt.find({ user: user._id, person: person._id, settled: false }).lean();
  const total = open.reduce((s, d) => s + d.amount, 0);
  if (!open.length || total === 0) {
    await Debt.updateMany({ user: user._id, person: person._id, settled: false }, { $set: { settled: true, settledAt: new Date() } });
    return ok({ ok: true });
  }
  if (account) {
    const income = total > 0;
    const cat = await Category.findOne({ user: user._id, type: income ? "income" : "expense", name: income ? "Other income" : "Other" }).lean();
    await createTransaction(user, {
      type: income ? "income" : "expense", amount: Math.abs(total), account, category: cat ? String(cat._id) : null,
      note: income ? `${person.name} settled up` : `Paid ${person.name} back`, tags: ["settle-up"], date: new Date(),
    }, { skipBudgetCheck: true });
  }
  await Debt.updateMany({ user: user._id, person: person._id, settled: false }, { $set: { settled: true, settledAt: new Date() } });
  return ok({ ok: true, total });
});
