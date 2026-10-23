import { authed, body, ok } from "@/lib/api";
import { goalInput } from "@/lib/schemas";
import { Goal } from "@/models";

export const POST = authed(async ({ req, user }) => {
  const { initial, ...input } = await body(req, goalInput);
  const g = await Goal.create({ ...input, user: user._id, contributions: initial > 0 ? [{ amount: initial, note: "Starting amount" }] : [] });
  return ok({ id: String(g._id) }, { status: 201 });
});
