import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { redis } from "./redis";
import { db } from "./db";
import { User, type UserDoc } from "@/models";

export const SESSION_COOKIE = "pocket_session";
const SESSION_TTL = 60 * 60 * 24 * 60; // 60 days, sliding

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function hashSecret(secret: string) {
  return hash(secret, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifySecret(hashValue: string, secret: string) {
  try {
    return await verify(hashValue, secret);
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await redis.set(`sess:${sha(token)}`, userId, "EX", SESSION_TTL);
  await redis.sadd(`usess:${userId}`, sha(token));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const id = await redis.get(`sess:${sha(token)}`);
    await redis.del(`sess:${sha(token)}`);
    if (id) await redis.srem(`usess:${id}`, sha(token));
  }
  jar.delete(SESSION_COOKIE);
}

/** Sign out every session for a user (after a password reset). */
export async function destroyAllSessions(userId: string) {
  const all = await redis.smembers(`usess:${userId}`);
  if (all.length) await redis.del(...all.map((h) => `sess:${h}`));
  await redis.del(`usess:${userId}`);
}

export async function sessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const key = `sess:${sha(token)}`;
  const id = await redis.get(key);
  if (id) await redis.expire(key, SESSION_TTL);
  return id;
}

export async function currentUser(): Promise<UserDoc | null> {
  const id = await sessionUserId();
  if (!id) return null;
  await db();
  return (await User.findById(id).lean()) as UserDoc | null;
}

export async function requireUser(): Promise<UserDoc> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please sign in again");
  return u;
}

export function publicUser(u: UserDoc) {
  return {
    id: String(u._id),
    email: u.email,
    name: u.name,
    currency: u.currency,
    timezone: u.timezone,
    monthStartDay: u.monthStartDay,
    weekStartsOn: u.weekStartsOn,
    defaultAccount: u.defaultAccount ? String(u.defaultAccount) : null,
    theme: u.theme,
    hideAmounts: u.hideAmounts,
    reminder: { enabled: u.reminder?.enabled ?? true, time: u.reminder?.time ?? "21:00" },
    alerts: u.alerts,
    lock: {
      enabled: !!u.lock?.enabled,
      faceId: !!u.lock?.faceId,
      hasPin: !!u.lock?.pinHash,
      autoLockSec: u.lock?.autoLockSec ?? 60,
    },
    setupStep: u.setupStep,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;
