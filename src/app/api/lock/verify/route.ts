import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError, destroySession, verifySecret } from "@/lib/auth";
import { redis } from "@/lib/redis";

/** Unlock with the PIN. Ten wrong tries signs you out. */
export const POST = authed(async ({ req, user }) => {
  const { pin } = await body(req, z.object({ pin: z.string().max(12) }));
  if (!user.lock?.pinHash) return ok({ ok: true });
  const key = `pinfail:${user._id}`;
  if (await verifySecret(user.lock.pinHash, pin)) {
    await redis.del(key);
    return ok({ ok: true });
  }
  const fails = await redis.incr(key);
  await redis.expire(key, 3600);
  if (fails >= 10) {
    await redis.del(key);
    await destroySession();
    throw new HttpError(401, "Too many wrong PINs. Sign in again.");
  }
  throw new HttpError(400, `Wrong PIN. ${10 - fails} ${10 - fails === 1 ? "try" : "tries"} left.`);
});
