import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError, destroyAllSessions, destroySession, publicUser, verifySecret } from "@/lib/auth";
import { settingsInput } from "@/lib/schemas";
import { Account, Budget, Category, Debt, Goal, Notification, Passkey, Person, PushSub, Recurring, Template, Transaction, User } from "@/models";
import { assertAccount } from "@/lib/finance";

export const GET = authed(async ({ user }) => ok({ user: publicUser(user) }));

export const PATCH = authed(async ({ req, user }) => {
  const input = await body(req, settingsInput);
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "lock" && v) {
      const l = v as { enabled: boolean; faceId: boolean; autoLockSec: number };
      if (l.enabled && !user.lock?.pinHash) throw new HttpError(400, "Set a PIN first");
      set["lock.enabled"] = l.enabled;
      set["lock.faceId"] = l.faceId;
      set["lock.autoLockSec"] = l.autoLockSec;
    } else if (k === "reminder" && v) {
      set["reminder.enabled"] = (v as { enabled: boolean }).enabled;
      set["reminder.time"] = (v as { time: string }).time;
    } else if (k === "defaultAccount") {
      if (v) await assertAccount(user._id, v as string);
      set.defaultAccount = v || null;
    } else if (k === "timezone") {
      try { new Intl.DateTimeFormat("en-US", { timeZone: v as string }); } catch { throw new HttpError(400, "Unknown timezone"); }
      set.timezone = v;
    } else set[k] = v;
  }
  const updated = await User.findByIdAndUpdate(user._id, { $set: set }, { new: true }).lean();
  return ok({ user: publicUser(updated!) });
});

/** Delete the account and everything in it. Requires the password. */
export const DELETE = authed(async ({ req, user }) => {
  const { password } = await body(req, z.object({ password: z.string().min(1) }));
  const full = await User.findById(user._id);
  if (!full || !(await verifySecret(full.passwordHash, password))) throw new HttpError(401, "Wrong password");
  const owned = await Account.find({ owner: user._id }).select("_id").lean();
  const ids = owned.map((a) => a._id);
  await Promise.all([
    Transaction.deleteMany({ $or: [{ account: { $in: ids } }, { user: user._id }] }),
    Account.deleteMany({ owner: user._id }),
    Account.updateMany({}, { $pull: { members: { user: user._id } } }),
    ...[Category, Budget, Goal, Recurring, Template, Person, Debt, Notification, PushSub, Passkey].map((M) => (M as typeof Category).deleteMany({ user: user._id })),
  ]);
  await User.deleteOne({ _id: user._id });
  await destroyAllSessions(String(user._id));
  await destroySession();
  return ok({ ok: true });
});
