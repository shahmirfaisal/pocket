import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { accountInput } from "@/lib/schemas";
import { Account, User } from "@/models";

/** Onboarding: main currency + starting accounts. */
export const POST = authed(async ({ req, user }) => {
  const input = await body(
    req,
    z.object({
      currency: z.string().length(3),
      timezone: z.string().optional(),
      accounts: z.array(accountInput).max(12),
    })
  );
  const existing = await Account.countDocuments({ owner: user._id });
  const created = existing
    ? []
    : await Account.insertMany(input.accounts.map((a, i) => ({ ...a, currency: a.currency || input.currency, owner: user._id, order: i })));
  const set: Record<string, unknown> = { currency: input.currency, setupStep: 3 };
  if (input.timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }); set.timezone = input.timezone; } catch {}
  }
  if (created[0] && !user.defaultAccount) set.defaultAccount = created.find((a) => a.type === "cash")?._id ?? created[0]._id;
  await User.updateOne({ _id: user._id }, { $set: set });
  return ok({ ok: true });
});
