import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { Notification } from "@/models";

export const GET = authed(async ({ user }) => {
  const rows = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(60).lean();
  return ok({ notifications: rows.map((n) => ({ id: String(n._id), kind: n.kind, title: n.title, body: n.body, link: n.link ?? null, read: n.read, createdAt: n.createdAt })) });
});

/** Mark notifications read: { all: true } or { ids: [...] } */
export const POST = authed(async ({ req, user }) => {
  const input = await body(req, z.object({ all: z.boolean().optional(), ids: z.array(z.string()).optional() }));
  const q: Record<string, unknown> = { user: user._id, read: false };
  if (!input.all) q._id = { $in: input.ids ?? [] };
  await Notification.updateMany(q, { $set: { read: true } });
  return ok({ ok: true });
});
