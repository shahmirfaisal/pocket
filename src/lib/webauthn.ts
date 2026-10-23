import "server-only";
import type { NextRequest } from "next/server";

export function rp(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = process.env.APP_URL?.replace(/\/$/, "") || `${proto}://${host}`;
  const rpID = process.env.APP_DOMAIN || new URL(origin).hostname;
  return { origin, rpID, rpName: "Pocket" };
}
