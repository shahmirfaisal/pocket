import { createHash } from "node:crypto";
import { z } from "zod";
import { open, body, ok } from "@/lib/api";
import { HttpError, createSession, destroyAllSessions, hashSecret } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { User } from "@/models";

export const POST = open(async ({ req }) => {
  const { token, password } = await body(req, z.object({ token: z.string().min(10), password: z.string().min(8, "Use at least 8 characters").max(200) }));
  const key = `reset:${createHash("sha256").update(token).digest("hex")}`;
  const userId = await redis.get(key);
  if (!userId) throw new HttpError(400, "This reset link has expired. Ask for a new one.");
  await redis.del(key);
  // A password reset also clears the app-lock PIN, since "Forgot PIN" sends people here.
  await User.updateOne({ _id: userId }, { $set: { passwordHash: await hashSecret(password) }, $unset: { "lock.pinHash": 1 } });
  await destroyAllSessions(userId);
  await createSession(userId);
  return ok({ ok: true });
});
