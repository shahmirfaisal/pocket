import { z } from "zod";
import { authed, body, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { Account } from "@/models";

/** Accept or decline an invite to a shared wallet. */
export const POST = authed<{ id: string }>(async ({ req, user, params }) => {
  const { accept } = await body(req, z.object({ accept: z.boolean() }));
  const a = await Account.findById(params.id);
  const m = a?.members.find((x) => x.email === user.email && x.status === "pending");
  if (!a || !m) throw new HttpError(404, "Invite not found");
  if (accept) {
    m.status = "active";
    m.user = user._id;
    m.name = user.name;
  } else m.deleteOne();
  await a.save();
  if (accept) await notify(String(a.owner), { kind: "shared", title: `${user.name} joined ${a.name}`, link: `/wallets/${a._id}` });
  return ok({ ok: true });
});
