import "server-only";
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

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
