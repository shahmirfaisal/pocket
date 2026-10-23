import { authed, body, ok } from "@/lib/api";
import { accountInput } from "@/lib/schemas";
import { accountsWithBalances } from "@/lib/finance";
import { Account } from "@/models";

export const GET = authed(async ({ req, user }) => {
  const all = req.nextUrl.searchParams.get("archived") === "1";
  const accounts = await accountsWithBalances(user, all);
  const netWorth = accounts.filter((a) => a.includeInTotal && !a.archived).reduce((s, a) => s + a.balance, 0);
  const invites = await Account.find({ members: { $elemMatch: { email: user.email, status: "pending" } } })
    .populate<{ owner: { name: string } }>("owner", "name")
    .lean();
  return ok({
    accounts,
    netWorth,
    invites: invites.map((a) => ({ id: String(a._id), name: a.name, from: a.owner?.name ?? "Someone" })),
  });
});

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, accountInput);
  const order = await Account.countDocuments({ owner: user._id });
  const a = await Account.create({ ...input, owner: user._id, order });
  return ok({ id: String(a._id) }, { status: 201 });
});
