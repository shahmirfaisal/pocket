import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { authed, ok } from "@/lib/api";
import { HttpError } from "@/lib/auth";

import { UPLOAD_DIR } from "@/lib/uploads";
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const POST = authed(async ({ req, user }) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No photo attached");
  const ext = TYPES[file.type];
  if (!ext) throw new HttpError(400, "Use a JPG, PNG or WebP photo");
  if (file.size > 6 * 1024 * 1024) throw new HttpError(400, "That photo is too large (6 MB max)");
  const buf = Buffer.from(await file.arrayBuffer());
  const magic = buf.subarray(0, 12).toString("hex");
  const okMagic = magic.startsWith("ffd8ff") || magic.startsWith("89504e47") || (magic.startsWith("52494646") && buf.subarray(8, 12).toString() === "WEBP");
  if (!okMagic) throw new HttpError(400, "That file isn't a photo");
  const name = `${user._id}-${randomBytes(8).toString("hex")}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buf);
  return ok({ name }, { status: 201 });
});
