import { authed, body, ok } from "@/lib/api";
import { templateInput } from "@/lib/schemas";
import { Template } from "@/models";

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const input = await body(req, templateInput.partial());
  await Template.updateOne({ _id: params.id, user: user._id }, { $set: input });
  return ok({ ok: true });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  await Template.deleteOne({ _id: params.id, user: user._id });
  return ok({ ok: true });
});
