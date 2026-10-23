import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { budgetInput } from "@/lib/schemas";
import { Budget } from "@/models";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const b = await Budget.findOne({ _id: params.id, user: user._id }).lean();
  if (!b) throw new HttpError(404, "Budget not found");
  return ok({ budget: { id: String(b._id), category: b.category ? String(b.category) : null, amount: b.amount, period: b.period, rollover: b.rollover, alerts: b.alerts } });
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, budgetInput.partial());
  const r = await Budget.updateOne({ _id: params.id, user: user._id }, { $set: { ...input, alertState: { periodKey: "", sent: [] } } });
  if (!r.matchedCount) throw new HttpError(404, "Budget not found");
  return ok({ ok: true });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await Budget.deleteOne({ _id: params.id, user: user._id });
  return ok({ ok: true });
});
