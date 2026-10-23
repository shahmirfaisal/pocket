import { authed, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { Account } from "@/models";

/** Owner removes a member, or a member leaves. */
export const DELETE = authed<{ id: string; memberId: string }>(async ({ user, params }) => {
  const a = await Account.findById(params.id);
  if (!a) throw new HttpError(404, "Account not found");
  const m = a.members.id(params.memberId);
  if (!m) throw new HttpError(404, "Member not found");
  const isOwner = String(a.owner) === String(user._id);
  if (!isOwner && String(m.user) !== String(user._id)) throw new HttpError(403, "Only the owner can remove people");
  m.deleteOne();
  await a.save();
  return ok({ ok: true });
});
