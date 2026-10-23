import { Types } from "mongoose";
import { authed, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { Account, Budget, Category, Debt, Goal, Person, Recurring, Template, Transaction, User } from "@/models";

type Doc = Record<string, unknown> & { _id?: string };

/**
 * Restore a backup. This REPLACES everything you own. New ids are created and
 * every reference is remapped, so a backup can be restored into any account.
 */
export const POST = authed(async ({ req, user }) => {
  const text = await req.text();
  if (text.length > 50 * 1024 * 1024) throw new HttpError(400, "Backup file is too large");
  let data: Record<string, Doc[]> & { app?: string };
  try { data = JSON.parse(text); } catch { throw new HttpError(400, "That isn't a Pocket backup file"); }
  if (data.app !== "pocket") throw new HttpError(400, "That isn't a Pocket backup file");

  const map = new Map<string, Types.ObjectId>();
  const id = (old: unknown) => {
    if (!old) return undefined;
    const k = String(old);
    if (!map.has(k)) map.set(k, new Types.ObjectId());
    return map.get(k)!;
  };
  const arr = (k: string) => (Array.isArray(data[k]) ? data[k] : []);
  const uid = user._id;
  const strip = ({ _id, __v, createdAt, updatedAt, ...rest }: Doc) => { void __v; void createdAt; void updatedAt; return { rest, _id }; };

  const accounts = arr("accounts").map((d) => { const { rest, _id } = strip(d); return { ...rest, _id: id(_id), owner: uid, members: [] }; });
  const categories = arr("categories").map((d) => { const { rest, _id } = strip(d); return { ...rest, _id: id(_id), user: uid }; });
  const people = arr("people").map((d) => { const { rest, _id } = strip(d); return { ...rest, _id: id(_id), user: uid }; });
  const recurring = arr("recurring").map((d) => { const { rest, _id } = strip(d); return { ...rest, _id: id(_id), user: uid, account: id(rest.account), category: id(rest.category) }; });
  const accIds = new Set(accounts.map((a) => String(a._id)));
  const transactions = arr("transactions")
    .map((d) => { const { rest, _id } = strip(d); return { ...rest, _id: id(_id), user: uid, account: id(rest.account), toAccount: id(rest.toAccount), category: id(rest.category), recurring: id(rest.recurring), clientId: undefined }; })
    .filter((t) => t.account && accIds.has(String(t.account)) && (!t.toAccount || accIds.has(String(t.toAccount))));
  const budgets = arr("budgets").map((d) => { const { rest } = strip(d); return { ...rest, user: uid, category: id(rest.category), alertState: undefined }; });
  const goals = arr("goals").map((d) => { const { rest } = strip(d); return { ...rest, user: uid, contributions: ((rest.contributions as Doc[]) ?? []).map(({ _id, ...c }) => { void _id; return { ...c, account: id(c.account) }; }) }; });
  const templates = arr("templates").map((d) => { const { rest } = strip(d); return { ...rest, user: uid, account: id(rest.account), category: id(rest.category) }; });
  const debts = arr("debts").map((d) => { const { rest } = strip(d); return { ...rest, user: uid, person: id(rest.person), transaction: id(rest.transaction) }; });

  // Validate everything before deleting anything.
  const checks: [typeof Account, unknown[]][] = [[Account, accounts], [Category, categories], [Person, people], [Recurring, recurring], [Transaction, transactions], [Budget, budgets], [Goal, goals], [Template, templates], [Debt, debts]] as never;
  for (const [M, docs] of checks) for (const d of docs) { const err = new M(d).validateSync(); if (err) throw new HttpError(400, `Backup has an invalid ${M.modelName.toLowerCase()}: ${err.message.slice(0, 120)}`); }

  const owned = (await Account.find({ owner: uid }).select("_id").lean()).map((a) => a._id);
  await Transaction.deleteMany({ $or: [{ account: { $in: owned } }, { user: uid }] });
  await Promise.all([Account, Category, Person, Recurring, Budget, Goal, Template, Debt].map((M) => (M === Account ? Account.deleteMany({ owner: uid }) : (M as typeof Category).deleteMany({ user: uid }))));
  for (const [M, docs] of checks) if (docs.length) await M.insertMany(docs as never[], { ordered: false });

  const s = (data as unknown as { settings?: Record<string, unknown> }).settings ?? {};
  const set: Record<string, unknown> = {};
  for (const k of ["currency", "timezone", "monthStartDay", "weekStartsOn", "theme", "reminder", "alerts"]) if (s[k] !== undefined) set[k] = s[k];
  set.defaultAccount = id(s.defaultAccount) && accIds.has(String(id(s.defaultAccount))) ? id(s.defaultAccount) : accounts[0]?._id ?? null;
  set.setupStep = 3;
  await User.updateOne({ _id: uid }, { $set: set });
  return ok({ ok: true, counts: { accounts: accounts.length, transactions: transactions.length, categories: categories.length } });
});
