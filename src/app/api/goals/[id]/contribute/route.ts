import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { objectId } from "@/lib/schemas";
import { assertAccount } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notify";
import { Goal } from "@/models";

/** Add money to a goal (positive) or withdraw from it (negative). */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, z.object({ amount: z.number().int().refine((n) => n !== 0), note: z.string().max(80).default(""), account: objectId.nullable().optional(), date: z.coerce.date().optional() }));
  const g = await Goal.findOne({ _id: params.id, user: user._id });
  if (!g) throw new HttpError(404, "Goal not found");
  if (input.account) await assertAccount(user._id, input.account);
  const before = g.contributions.reduce((s, c) => s + c.amount, 0);
  if (before + input.amount < 0) throw new HttpError(400, `You can withdraw up to ${formatMoney(before, user.currency)}`);
  g.contributions.push({ amount: input.amount, note: input.note, account: input.account ?? undefined, date: input.date ?? new Date() });
  await g.save();
  const after = before + input.amount;
  for (const mark of [100, 75, 50]) {
    const t = (g.target * mark) / 100;
    if (before < t && after >= t) {
      await notify(String(user._id), { kind: "goal", title: mark === 100 ? `You reached ${g.name}! 🎉` : `${g.name} goal: ${mark}% there`, body: `${formatMoney(after, user.currency)} of ${formatMoney(g.target, user.currency)} saved.`, link: `/goals/${g._id}` });
      break;
    }
  }
  return ok({ ok: true });
});
