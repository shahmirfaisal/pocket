import { authed } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { Account, Budget, Category, Debt, Goal, Person, Recurring, Template, Transaction, User } from "@/models";
import { redis } from "@/lib/redis";

/** Full JSON backup of everything you own. */
export const GET = authed(async ({ user }) => {
  const accounts = await Account.find({ owner: user._id }).lean();
  const ids = accounts.map((a) => a._id);
  const [categories, transactions, budgets, goals, recurring, templates, people, debts] = await Promise.all([
    Category.find({ user: user._id }).lean(),
    Transaction.find({ $or: [{ account: { $in: ids } }, { user: user._id }] }).lean(),
    Budget.find({ user: user._id }).lean(),
    Goal.find({ user: user._id }).lean(),
    Recurring.find({ user: user._id }).lean(),
    Template.find({ user: user._id }).lean(),
    Person.find({ user: user._id }).lean(),
    Debt.find({ user: user._id }).lean(),
  ]);
  const u = await User.findById(user._id).select("name currency timezone monthStartDay weekStartsOn defaultAccount theme reminder alerts").lean();
  const data = { app: "pocket", version: 1, exportedAt: new Date().toISOString(), settings: u, accounts, categories, transactions, budgets, goals, recurring, templates, people, debts };
  await redis.set(`lastbackup:${user._id}`, new Date().toISOString());
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="pocket-backup-${dayKey(new Date(), user.timezone || "Asia/Karachi")}.json"` },
  });
});
