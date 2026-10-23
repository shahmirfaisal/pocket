import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { Debt, Person } from "@/models";

export const PATCH = authed<{ id: string }>(async ({ req, user, params }) => {
  const { name } = await body(req, z.object({ name: z.string().trim().min(1).max(40) }));
  await Person.updateOne({ _id: params.id, user: user._id }, { $set: { name } });
  return ok({ ok: true });
});

export const DELETE = authed<{ id: string }>(async ({ user, params }) => {
  const open = await Debt.countDocuments({ user: user._id, person: params.id, settled: false });
  if (open) throw new HttpError(400, "Settle up before removing this person");
  await Debt.deleteMany({ user: user._id, person: params.id });
  await Person.deleteOne({ _id: params.id, user: user._id });
  return ok({ ok: true });
});
