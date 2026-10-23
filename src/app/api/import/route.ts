import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { Account, Category, Transaction } from "@/models";
import { accessibleAccounts } from "@/lib/finance";

const row = z.object({
  date: z.coerce.date(),
  amount: z.number().int().refine((n) => n !== 0),
  type: z.enum(["expense", "income"]).optional(),
  category: z.string().max(40).optional().default(""),
  account: z.string().max(40).optional().default(""),
  note: z.string().max(200).optional().default(""),
});

/** Import rows already parsed from a CSV in the browser. Creates missing accounts and categories by name. */
export const POST = authed(async ({ req, user }) => {
  const { rows, defaultAccount } = await body(req, z.object({ rows: z.array(row).min(1).max(20000), defaultAccount: z.string().optional() }));
  const accounts = await accessibleAccounts(user._id);
  const accByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a._id]));
  const cats = await Category.find({ user: user._id }).lean();
  const catByName = new Map(cats.map((c) => [`${c.type}:${c.name.toLowerCase()}`, c._id]));
  const fallbackAcc = (defaultAccount && accounts.find((a) => String(a._id) === defaultAccount)?._id) || user.defaultAccount || accounts[0]?._id;
  let createdAccounts = 0, createdCategories = 0;
  const docs = [];
  for (const r of rows) {
    const type = r.type ?? (r.amount < 0 ? "expense" : "income");
    let acc = r.account ? accByName.get(r.account.toLowerCase()) : fallbackAcc;
    if (!acc && r.account) {
      const a = await Account.create({ owner: user._id, name: r.account.slice(0, 40), type: "bank", currency: user.currency });
      accByName.set(r.account.toLowerCase(), a._id); acc = a._id; createdAccounts++;
    }
    if (!acc) {
      const a = await Account.create({ owner: user._id, name: "Imported", type: "bank", currency: user.currency });
      accByName.set("imported", a._id); acc = a._id; createdAccounts++;
    }
    let cat = r.category ? catByName.get(`${type}:${r.category.toLowerCase()}`) : undefined;
    if (!cat && r.category) {
      const c = await Category.create({ user: user._id, name: r.category.slice(0, 30), type, emoji: "🏷️", color: "#F1F2F4", order: 500 });
      catByName.set(`${type}:${r.category.toLowerCase()}`, c._id); cat = c._id; createdCategories++;
    }
    docs.push({ user: user._id, account: acc, type, amount: Math.abs(r.amount), category: cat, note: r.note, date: r.date, tags: ["imported"] });
  }
  await Transaction.insertMany(docs, { ordered: false });
  return ok({ imported: docs.length, createdAccounts, createdCategories });
});
