import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { recurringInput } from "@/lib/schemas";
import { assertAccount } from "@/lib/finance";
import { Recurring } from "@/models";
import { partsIn } from "@/lib/dates";

export const GET = authed<{ id: string }>(async ({ user, params }) => {
  const r = await Recurring.findOne({ _id: params.id, user: user._id }).lean();
  if (!r) throw new HttpError(404, "Not found");
  return ok({ item: { ...r, id: String(r._id), account: String(r.account), category: r.category ? String(r.category) : null } });
});

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, recurringInput.partial());
  if (input.account) await assertAccount(user._id, input.account);
  const set: Record<string, unknown> = { ...input };
  if (input.nextDate) set.anchorDay = partsIn(input.nextDate, user.timezone || "Asia/Karachi").d;
  const r = await Recurring.updateOne({ _id: params.id, user: user._id }, { $set: set });
  if (!r.matchedCount) throw new HttpError(404, "Not found");
  return ok({ ok: true });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await Recurring.deleteOne({ _id: params.id, user: user._id });
  return ok({ ok: true });
});
