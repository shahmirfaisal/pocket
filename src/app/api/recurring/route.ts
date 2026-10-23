import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { recurringInput } from "@/lib/schemas";
import { assertAccount } from "@/lib/finance";
import { Category, Recurring } from "@/models";
import { monthlyEquivalent } from "@/lib/recurring";
import { partsIn } from "@/lib/dates";

export const GET = authed(async ({ user }) => {
  const rows = await Recurring.find({ user: user._id })
    .sort({ nextDate: 1 })
    .populate<{ account: { _id: unknown; name: string } }>("account", "name")
    .populate<{ category: { _id: unknown; name: string; emoji: string; color: string } | null }>("category", "name emoji color")
    .lean();
  const active = rows.filter((r) => !r.paused);
  return ok({
    bills: Math.round(active.filter((r) => r.type === "expense").reduce((s, r) => s + monthlyEquivalent(r), 0)),
    income: Math.round(active.filter((r) => r.type === "income").reduce((s, r) => s + monthlyEquivalent(r), 0)),
    items: rows.map((r) => ({
      id: String(r._id), type: r.type, name: r.name, emoji: r.category?.emoji ?? r.emoji, color: r.category?.color ?? "#F1F2F4", amount: r.amount,
      account: { id: String(r.account?._id), name: r.account?.name ?? "" },
      category: r.category ? { id: String(r.category._id), name: r.category.name } : null,
      subcategory: r.subcategory ?? null,
      frequency: r.frequency, interval: r.interval, nextDate: r.nextDate, mode: r.mode, subscription: r.subscription, paused: r.paused,
    })),
  });
});

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, recurringInput);
  await assertAccount(user._id, input.account);
  if (input.category && !(await Category.exists({ _id: input.category, user: user._id }))) throw new HttpError(400, "Unknown category");
  const r = await Recurring.create({ ...input, user: user._id, anchorDay: partsIn(input.nextDate, user.timezone || "Asia/Karachi").d });
  return ok({ id: String(r._id) }, { status: 201 });
});
