import { open, body, ok, clientIp } from "@/lib/api";
import { HttpError, createSession, hashSecret, verifySecret } from "@/lib/auth";
import { rateLimit, redis } from "@/lib/redis";
import { loginSchema } from "@/lib/schemas";
import { User } from "@/models";

let dummy: Promise<string> | null = null;

export const POST = open(async ({ req }) => {
  const input = await body(req, loginSchema);
  const allowedIp = await rateLimit(`login-ip:${clientIp(req)}`, 30, 900);
  const allowedEmail = await rateLimit(`login-email:${input.email}`, 8, 900);
  if (!allowedIp || !allowedEmail) throw new HttpError(429, "Too many attempts. Wait 15 minutes and try again.");
  const user = await User.findOne({ email: input.email });
  // Verify against a dummy hash when the user doesn't exist so timing doesn't reveal accounts.
  const valid = user
    ? await verifySecret(user.passwordHash, input.password)
    : await verifySecret(await (dummy ??= hashSecret("pocket-timing-guard")), input.password);
  if (!user || !valid) throw new HttpError(401, "That email and password don't match");
  await createSession(String(user._id));
  // A fresh password sign-in lets you reset a forgotten app-lock PIN for 15 minutes.
  await redis.set(`fresh:${user._id}`, "1", "EX", 900);
  return ok({ ok: true, next: (user.setupStep ?? 3) < 3 ? "/setup" : "/" });
});
