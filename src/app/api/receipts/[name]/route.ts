import { readFile } from "node:fs/promises";
import path from "node:path";
import { authed } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { accessibleAccountIds } from "@/lib/finance";
import { UPLOAD_DIR } from "@/lib/uploads";
import { Transaction } from "@/models";

export const GET = authed<{ name: string }>(async ({ user, params }) => {
  if (!/^[a-f\d]{24}-[a-f\d]{16}\.(jpg|png|webp)$/.test(params.name)) throw new HttpError(404, "Not found");
  const mine = params.name.startsWith(String(user._id));
  if (!mine) {
    const ids = await accessibleAccountIds(user._id);
    if (!(await Transaction.exists({ receipt: params.name, account: { $in: ids } }))) throw new HttpError(404, "Not found");
  }
  let data: Buffer;
  try { data = await readFile(path.join(UPLOAD_DIR, params.name)); } catch { throw new HttpError(404, "Not found"); }
  const type = params.name.endsWith(".png") ? "image/png" : params.name.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=31536000, immutable" } });
});
