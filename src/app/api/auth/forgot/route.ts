import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { open, body, ok, clientIp } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { rateLimit, redis } from "@/lib/redis";
import { sendMail } from "@/lib/mail";
import { User } from "@/models";

export const POST = open(async ({ req }) => {
  const { email } = await body(req, z.object({ email: z.email().transform((s) => s.toLowerCase()) }));
  if (!(await rateLimit(`forgot-ip:${clientIp(req)}`, 10, 3600)) || !(await rateLimit(`forgot:${email}`, 3, 900)) ) {
    throw new HttpError(429, "Too many requests. Wait a few minutes and try again.");
  }
  const user = await User.findOne({ email }).lean();
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const key = `reset:${createHash("sha256").update(token).digest("hex")}`;
    await redis.set(key, String(user._id), "EX", 30 * 60);
    const url = `${process.env.APP_URL || new URL(req.url).origin}/reset-password?token=${token}`;
    await sendMail(
      email,
      "Reset your Pocket password",
      "Reset your password",
      `Hi ${user.name.split(" ")[0]}, tap the button below to choose a new password. The link expires in 30 minutes.`,
      { label: "Choose a new password", url }
    );
  }
  // Same response either way so the form can't be used to find out who has an account.
  return ok({ ok: true });
});
