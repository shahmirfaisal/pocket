import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError, hashSecret, verifySecret } from "@/lib/auth";
import { User } from "@/models";
import { redis } from "@/lib/redis";

/** Set or change the app-lock PIN. Changing it needs the current PIN. */
export const POST = authed(async ({ req, user }) => {
  const { pin, current } = await body(req, z.object({ pin: z.string().regex(/^\d{4}$/, "Use 4 digits"), current: z.string().optional() }));
  const fresh = await redis.get(`fresh:${user._id}`);
  if (user.lock?.pinHash && !fresh && !(current && (await verifySecret(user.lock.pinHash, current)))) throw new HttpError(401, "Your current PIN is wrong");
  await User.updateOne({ _id: user._id }, { $set: { "lock.pinHash": await hashSecret(pin), "lock.enabled": true } });
  return ok({ ok: true });
});

/** Turn the lock off entirely (needs the PIN). */
export const DELETE = authed(async ({ req, user }) => {
  const { pin } = await body(req, z.object({ pin: z.string() }));
  if (user.lock?.pinHash && !(await verifySecret(user.lock.pinHash, pin))) throw new HttpError(401, "Wrong PIN");
  await User.updateOne({ _id: user._id }, { $set: { "lock.enabled": false, "lock.faceId": false }, $unset: { "lock.pinHash": 1 } });
  return ok({ ok: true });
});
