import "server-only";
import { Types } from "mongoose";
import type { z } from "zod";
import { Account, Category, Debt, Person, Recurring, Transaction, type UserDoc } from "@/models";
import { assertAccount, checkBudgets } from "./finance";
import { HttpError } from "./auth";
import type { txInput } from "./schemas";
import { advance, partsIn } from "./dates";
import { notify } from "./notify";
import { formatMoney } from "./money";
import { PERSON_COLORS } from "./defaults";

export type TxInput = z.infer<typeof txInput>;

async function validateRefs(user: UserDoc, input: Pick<TxInput, "type" | "account" | "toAccount" | "category" | "subcategory">) {
  const acc = await assertAccount(user._id, input.account);
  if (input.type === "transfer") {
    if (!input.toAccount) throw new HttpError(400, "Pick an account to move money to");
    await assertAccount(user._id, input.toAccount);
  }
  let category: Types.ObjectId | undefined;
  if (input.type !== "transfer" && input.category) {
    const c = await Category.findOne({ _id: input.category, user: user._id }).lean();
    if (!c) throw new HttpError(400, "Unknown category");
    if (input.subcategory && !(c.subcategories ?? []).includes(input.subcategory)) throw new HttpError(400, "Unknown subcategory");
    category = c._id;
  }
  return { acc, category };
}

async function resolvePerson(user: UserDoc, p: { person?: string; name?: string }) {
  if (p.person) {
    const found = await Person.findOne({ _id: p.person, user: user._id });
    if (!found) throw new HttpError(400, "Unknown person");
    return found;
  }
  const name = (p.name ?? "").trim();
  if (!name) throw new HttpError(400, "Enter a name to split with");
  const existing = await Person.findOne({ user: user._id, name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
  if (existing) return existing;
  const count = await Person.countDocuments({ user: user._id });
  return Person.create({ user: user._id, name, color: PERSON_COLORS[count % PERSON_COLORS.length] });
}

export async function createTransaction(user: UserDoc, input: TxInput, opts: { recurring?: Types.ObjectId; skipBudgetCheck?: boolean } = {}) {
  if (input.clientId) {
    const dup = await Transaction.findOne({ user: user._id, clientId: input.clientId }).lean();
    if (dup) return dup;
  }
  const { acc, category } = await validateRefs(user, input);
  const tx = await Transaction.create({
    user: user._id,
    account: input.account,
    toAccount: input.type === "transfer" ? input.toAccount : undefined,
    type: input.type,
    amount: input.amount,
    category: input.type === "transfer" ? undefined : category,
    subcategory: input.type === "transfer" ? undefined : input.subcategory || undefined,
    note: input.note,
    tags: input.tags,
    date: input.date,
    receipt: input.receipt || undefined,
    clientId: input.clientId,
    recurring: opts.recurring,
  });

  if (input.split && input.type === "expense") {
    const total = input.split.people.reduce((s, p) => s + p.amount, 0);
    if (total > input.amount) throw new HttpError(400, "Split amounts are more than the total");
    for (const p of input.split.people) {
      const person = await resolvePerson(user, p);
      await Debt.create({ user: user._id, person: person._id, amount: p.amount, note: input.note || "Split", date: input.date, transaction: tx._id });
    }
  }

  if (input.repeat && input.type !== "transfer") {
    await Recurring.create({
      user: user._id, type: input.type, name: input.note || "Repeating", amount: input.amount, account: input.account,
      category, subcategory: input.subcategory || undefined, frequency: input.repeat, interval: 1,
      nextDate: advance(input.date, input.repeat, 1, user.timezone || "Asia/Karachi"), anchorDay: partsIn(input.date, user.timezone || "Asia/Karachi").d, mode: "auto",
    });
  }

  // Tell the other members of a shared wallet.
  if ((acc.members?.length ?? 0) > 0) {
    const others = [String(acc.owner), ...(acc.members ?? []).filter((m) => m.status === "active" && m.user).map((m) => String(m.user))].filter((id) => id !== String(user._id));
    const cat = category ? await Category.findById(category).select("name").lean() : null;
    const what = input.note || cat?.name || (input.type === "income" ? "income" : "an expense");
    for (const id of others) {
      await notify(id, { kind: "shared", title: `${user.name.split(" ")[0]} added ${what}`, body: `${formatMoney(input.amount, acc.currency)} in ${acc.name}`, link: `/transactions/${tx._id}` });
    }
  }

  if (!opts.skipBudgetCheck && input.type === "expense") checkBudgets(user).catch((e) => console.error("[budgets]", e));
  return tx.toObject();
}

export async function updateTransaction(user: UserDoc, id: string, input: TxInput) {
  const tx = await Transaction.findById(id);
  if (!tx) throw new HttpError(404, "Transaction not found");
  await assertAccount(user._id, String(tx.account));
  const { category } = await validateRefs(user, input);
  tx.set({
    account: input.account,
    toAccount: input.type === "transfer" ? input.toAccount : undefined,
    type: input.type,
    amount: input.amount,
    category: input.type === "transfer" ? undefined : category ?? tx.category,
    subcategory: input.type === "transfer" ? undefined : input.subcategory || undefined,
    note: input.note,
    tags: input.tags,
    date: input.date,
    receipt: input.receipt === undefined ? tx.receipt : input.receipt || undefined,
  });
  await tx.save();
  if (input.type === "expense") checkBudgets(user).catch(() => {});
  return tx.toObject();
}

export async function deleteTransaction(user: UserDoc, id: string) {
  const tx = await Transaction.findById(id);
  if (!tx) throw new HttpError(404, "Transaction not found");
  await assertAccount(user._id, String(tx.account));
  await Debt.deleteMany({ transaction: tx._id, settled: false });
  await tx.deleteOne();
}

export async function accountExists(id: string) {
  return !!(await Account.exists({ _id: id }));
}
