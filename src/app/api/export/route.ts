import { authed } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { loadRows, toCsv, toPdf, toXlsx } from "@/lib/exporter";
import { monthRange, dayKey } from "@/lib/dates";

/** GET /api/export?format=csv|xlsx|pdf&from=ISO&to=ISO  (defaults to this month) */
export const GET = authed(async ({ req, user }) => {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") || "csv";
  const tz = user.timezone || "Asia/Karachi";
  const m = monthRange(new Date(), tz, user.monthStartDay ?? 1);
  const from = sp.get("from") ? new Date(sp.get("from")!) : m.start;
  const to = sp.get("to") ? new Date(sp.get("to")!) : m.end;
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) throw new HttpError(400, "Pick a valid date range");
  const rows = await loadRows(user, from, to);
  const name = `pocket-${dayKey(from, tz)}-to-${dayKey(new Date(to.getTime() - 1), tz)}`;
  if (format === "csv") {
    return new Response("﻿" + toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
  }
  if (format === "xlsx") {
    const buf = await toXlsx(rows, user);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` } });
  }
  if (format === "pdf") {
    const buf = await toPdf(rows, user, from, to);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${sp.get("inline") ? "inline" : "attachment"}; filename="${name}.pdf"` } });
  }
  throw new HttpError(400, "Unknown format");
});
