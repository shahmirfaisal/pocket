import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { assertAccount } from "@/lib/finance";
import { sendMail } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { rateLimit } from "@/lib/redis";
import { Account, User } from "@/models";

/** Invite someone to a shared wallet by email. */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const a = await assertAccount(user._id, params.id, { owner: true });
  const { email, role } = await body(req, z.object({ email: z.email().transform((s) => s.toLowerCase()), role: z.enum(["editor", "viewer"]).default("editor") }));
  if (email === user.email) throw new HttpError(400, "That's you");
  if (!(await rateLimit(`invite:${user._id}`, 20, 3600))) throw new HttpError(429, "Too many invites. Try again later.");
  const existing = a.members?.find((m) => m.email === email);
  const invitee = await User.findOne({ email }).select("_id name").lean();
  if (!existing) {
    await Account.updateOne(
      { _id: a._id },
      { $push: { members: { email, role, status: "pending", user: invitee?._id, name: invitee?.name } } }
    );
  }
  const url = `${process.env.APP_URL || new URL(req.url).origin}/${invitee ? "wallets" : "signup"}`;
  // The invite is saved even if the email fails; they also see it in the app once they sign up.
  await sendMail(email, `${user.name} invited you to "${a.name}" on Pocket`, `Join ${a.name}`,
    `${user.name} wants to track <b>${a.name}</b> together with you in Pocket. ${invitee ? "Open Pocket to accept." : `Create a free account with <b>${email}</b> to join.`}`,
    { label: invitee ? "Open Pocket" : "Create account", url }).catch(() => {});
  if (invitee) await notify(String(invitee._id), { kind: "shared", title: `${user.name} invited you to ${a.name}`, body: "Accept to see and add spending together.", link: "/wallets" });
  return ok({ ok: true });
});
