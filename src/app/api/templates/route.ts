import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { templateInput } from "@/lib/schemas";
import { assertAccount } from "@/lib/finance";
import { Category, Template } from "@/models";

export const GET = authed(async ({ user }) => {
  const rows = await Template.find({ user: user._id }).sort({ order: 1, createdAt: 1 })
    .populate<{ account: { _id: unknown; name: string } | null }>("account", "name")
    .populate<{ category: { _id: unknown; name: string; emoji: string; color: string } | null }>("category", "name emoji color").lean();
  return ok({
    templates: rows.map((t) => ({
      id: String(t._id), name: t.name, emoji: t.emoji, type: t.type, amount: t.amount,
      account: t.account ? { id: String(t.account._id), name: t.account.name } : null,
      category: t.category ? { id: String(t.category._id), name: t.category.name, emoji: t.category.emoji, color: t.category.color } : null,
    })),
  });
});

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, templateInput);
  if (input.account) await assertAccount(user._id, input.account);
  if (input.category && !(await Category.exists({ _id: input.category, user: user._id }))) throw new HttpError(400, "Unknown category");
  const order = await Template.countDocuments({ user: user._id });
  const t = await Template.create({ ...input, user: user._id, order });
  return ok({ id: String(t._id) }, { status: 201 });
});
