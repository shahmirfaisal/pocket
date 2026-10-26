import "server-only";
import { BlockList, isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import mongoose from "mongoose";
import { HttpError, requireUser } from "./auth";
import { db } from "./db";
import type { UserDoc } from "@/models";

type Ctx<P> = { params: Promise<P> };

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

function sameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older Safari may omit it; cookie is SameSite=Lax
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function fail(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const field = first?.path?.join(".");
    return NextResponse.json({ error: field ? `${field}: ${first.message}` : first?.message ?? "Invalid input" }, { status: 400 });
  }
  if (e instanceof mongoose.Error.CastError) return NextResponse.json({ error: "Not found" }, { status: 404 });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

/** Route handler that needs a signed-in user. */
export function authed<P = Record<string, string>>(
  fn: (args: { req: NextRequest; user: UserDoc; params: P }) => Promise<Response> | Response
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!sameOrigin(req)) throw new HttpError(403, "Bad origin");
      await db();
      const user = await requireUser();
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await fn({ req, user, params });
    } catch (e) {
      return fail(e);
    }
  };
}

/** Route handler for signed-out endpoints (login, signup...). */
export function open<P = Record<string, string>>(fn: (args: { req: NextRequest; params: P }) => Promise<Response> | Response) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (!sameOrigin(req)) throw new HttpError(403, "Bad origin");
      await db();
      const params = ctx?.params ? await ctx.params : ({} as P);
      return await fn({ req, params });
    } catch (e) {
      return fail(e);
    }
  };
}

export async function body<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  return schema.parse(raw);
}

export function notFound(what = "Not found"): never {
  throw new HttpError(404, what);
}

// https://www.cloudflare.com/ips/
const cloudflare = new BlockList();
for (const cidr of ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"]) {
  const [ip, bits] = cidr.split("/");
  cloudflare.addSubnet(ip, Number(bits), "ipv4");
}
for (const cidr of ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"]) {
  const [ip, bits] = cidr.split("/");
  cloudflare.addSubnet(ip, Number(bits), "ipv6");
}

function fromCloudflare(ip: string) {
  const v = isIP(ip);
  return v !== 0 && cloudflare.check(ip, v === 6 ? "ipv6" : "ipv4");
}

export function clientIp(req: NextRequest) {
  // Caddy sets x-forwarded-for to the address that actually connected (it ignores client-sent values).
  // Behind Cloudflare that's a Cloudflare edge, and the visitor is in cf-connecting-ip. That header is
  // only trusted when the peer really is Cloudflare, so hitting the origin directly can't spoof it.
  const peer = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || req.headers.get("x-real-ip") || "";
  const cf = req.headers.get("cf-connecting-ip");
  if (cf && fromCloudflare(peer)) return cf;
  return peer || "local";
}
