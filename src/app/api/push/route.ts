import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { PushSub } from "@/models";

export const GET = authed(async () => ok({ key: process.env.VAPID_PUBLIC_KEY ?? null }));

export const POST = authed(async ({ req, user }) => {
  const sub = await body(req, z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }));
  await PushSub.updateOne({ endpoint: sub.endpoint }, { $set: { user: user._id, keys: sub.keys } }, { upsert: true });
  return ok({ ok: true });
});

export const DELETE = authed(async ({ req, user }) => {
  const { endpoint } = await body(req, z.object({ endpoint: z.string() }));
  await PushSub.deleteOne({ endpoint, user: user._id });
  return ok({ ok: true });
});
