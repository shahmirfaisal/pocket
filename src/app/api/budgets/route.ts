import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { budgetInput } from "@/lib/schemas";
import { budgetProgress, checkBudgets } from "@/lib/finance";
import { periodRange } from "@/lib/dates";
import { Budget, Category, Goal } from "@/models";

export const GET = authed(async ({ user }) => {
  const tz = user.timezone || "Asia/Karachi";
  const budgets = await Budget.find({ user: user._id }).populate<{ category: { _id: unknown; name: string; emoji: string; color: string } | null }>("category", "name emoji color").lean();
  const rows = await Promise.all(
    budgets.map(async (b) => {
      const p = await budgetProgress(user, { ...b, category: b.category ? (b.category._id as never) : null });
      return {
        id: String(b._id), period: b.period, amount: b.amount, rollover: b.rollover, alerts: b.alerts,
        category: b.category ? { id: String(b.category._id), name: b.category.name, emoji: b.category.emoji, color: b.category.color } : null,
        spent: p.spent, limit: p.limit, end: p.range.end,
      };
    })
  );
  const overall = rows.find((r) => !r.category && r.period === "monthly") ?? null;
  const m = periodRange("monthly", new Date(), tz, user.monthStartDay ?? 1);
  const daysLeft = Math.max(0, Math.ceil((m.end.getTime() - Date.now()) / 86400000));
  const goals = await Goal.find({ user: user._id, archived: false }).sort({ createdAt: 1 }).lean();
  return ok({
    overall: overall ?? (rows.length ? { id: null, period: "monthly", amount: rows.filter((r) => r.period === "monthly").reduce((s, r) => s + r.amount, 0), spent: rows.filter((r) => r.period === "monthly").reduce((s, r) => s + r.spent, 0), limit: rows.filter((r) => r.period === "monthly").reduce((s, r) => s + r.limit, 0), category: null, summed: true } : null),
    budgets: rows.filter((r) => r.category).sort((a, b) => b.spent / b.limit - a.spent / a.limit),
    daysLeft,
    goals: goals.map((g) => ({ id: String(g._id), name: g.name, emoji: g.emoji, target: g.target, saved: (g.contributions ?? []).reduce((s, c) => s + c.amount, 0), targetDate: g.targetDate ?? null })),
  });
});

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, budgetInput);
  if (input.category && !(await Category.exists({ _id: input.category, user: user._id }))) throw new HttpError(400, "Unknown category");
  if (await Budget.exists({ user: user._id, category: input.category ?? null, period: input.period })) throw new HttpError(409, "You already have this budget — edit it instead");
  const b = await Budget.create({ ...input, category: input.category ?? undefined, user: user._id });
  checkBudgets(user).catch(() => {});
  return ok({ id: String(b._id) }, { status: 201 });
});
