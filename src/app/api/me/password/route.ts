import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError, createSession, destroyAllSessions, hashSecret, verifySecret } from "@/lib/auth";
import { User } from "@/models";

export const POST = authed(async ({ req, user }) => {
  const { current, next } = await body(req, z.object({ current: z.string().min(1), next: z.string().min(8, "Use at least 8 characters").max(200) }));
  const full = await User.findById(user._id);
  if (!full || !(await verifySecret(full.passwordHash, current))) throw new HttpError(401, "Your current password is wrong");
  full.passwordHash = await hashSecret(next);
  await full.save();
  await destroyAllSessions(String(user._id));
  await createSession(String(user._id));
  return ok({ ok: true });
});
