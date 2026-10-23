import { authed, ok } from "@/lib/api";
import { Debt } from "@/models";

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await Debt.deleteOne({ _id: params.id, user: user._id });
  return ok({ ok: true });
});
