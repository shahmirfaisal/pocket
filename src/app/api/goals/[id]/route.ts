import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { goalInput } from "@/lib/schemas";
import { Goal } from "@/models";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const g = await Goal.findOne({ _id: params.id, user: user._id }).populate<{ contributions: { _id: unknown; amount: number; date: Date; note?: string; account?: { name: string } }[] }>("contributions.account", "name").lean();
  if (!g) throw new HttpError(404, "Goal not found");
  const saved = g.contributions.reduce((s, c) => s + c.amount, 0);
  const left = Math.max(0, g.target - saved);
  let perMonth: number | null = null, onTrack: boolean | null = null;
  if (g.targetDate) {
    const months = Math.max(1, (new Date(g.targetDate).getFullYear() - new Date().getFullYear()) * 12 + new Date(g.targetDate).getMonth() - new Date().getMonth());
    perMonth = Math.ceil(left / months);
    // On track if the average of the last 3 months of saving covers what's needed per month
    const since = new Date(Date.now() - 90 * 86400000);
    const recent = g.contributions.filter((c) => new Date(c.date) >= since).reduce((s, c) => s + c.amount, 0) / 3;
    onTrack = left === 0 || recent >= perMonth;
  }
  return ok({
    goal: {
      id: String(g._id), name: g.name, emoji: g.emoji, target: g.target, targetDate: g.targetDate ?? null, saved, left, perMonth, onTrack, archived: g.archived,
      contributions: [...g.contributions].sort((a, b) => +new Date(b.date) - +new Date(a.date)).map((c) => ({ id: String(c._id), amount: c.amount, date: c.date, note: c.note ?? "", account: c.account?.name ?? null })),
    },
  });
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, goalInput.omit({ initial: true }).partial().extend({ archived: z.boolean().optional() }));
  const r = await Goal.updateOne({ _id: params.id, user: user._id }, { $set: input });
  if (!r.matchedCount) throw new HttpError(404, "Goal not found");
  return ok({ ok: true });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await Goal.deleteOne({ _id: params.id, user: user._id });
  return ok({ ok: true });
});
