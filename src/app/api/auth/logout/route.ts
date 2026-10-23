import { open, ok } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export const POST = open(async () => {
  await destroySession();
  return ok({ ok: true });
});
