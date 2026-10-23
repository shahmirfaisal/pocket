import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { objectId } from "@/lib/schemas";
import { Category } from "@/models";

export const POST = authed(async ({ req, user }) => {
  const { ids } = await body(req, z.object({ ids: z.array(objectId).max(200) }));
  await Category.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, user: user._id }, update: { $set: { order: i } } } })));
  return ok({ ok: true });
});
