import { authed, body, ok } from "@/lib/api";
import { categoryInput } from "@/lib/schemas";
import { Category } from "@/models";
import { serializeCategory } from "@/lib/serialize";

export const GET = authed(async ({ user }) => {
  const cats = await Category.find({ user: user._id, archived: false }).sort({ order: 1, createdAt: 1 }).lean();
  return ok({ categories: cats.map(serializeCategory) });
});

export const POST = authed(async ({ req, user }) => {
  const input = await body(req, categoryInput);
  const order = await Category.countDocuments({ user: user._id, type: input.type });
  const c = await Category.create({ ...input, user: user._id, order });
  return ok({ category: serializeCategory(c.toObject()) }, { status: 201 });
});
