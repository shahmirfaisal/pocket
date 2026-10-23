import { authed, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { runRecurring } from "@/lib/recurring";
import { Recurring } from "@/models";

/** "Add now" for an "ask first" bill, or paying early. */
export const POST = authed<{ id: string }>(async ({ user, params }) => {
  const r = await Recurring.findOne({ _id: params.id, user: user._id });
  if (!r) throw new HttpError(404, "Not found");
  const tx = await runRecurring(user, r);
  return ok({ transaction: String(tx._id) });
});
