"use client";
import Dexie, { type Table } from "dexie";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Queued = { id?: number; clientId: string; body: unknown; createdAt: number };
class OfflineDB extends Dexie {
  queue!: Table<Queued, number>;
  constructor() {
    super("pocket-offline");
    this.version(1).stores({ queue: "++id, clientId, createdAt" });
  }
}
let odb: OfflineDB | null = null;
const offlineDb = () => (odb ??= new OfflineDB());

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData; raw?: boolean } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    credentials: "same-origin",
  });
  if (res.status === 401 && !path.startsWith("/api/auth") && !path.startsWith("/api/lock")) {
    if (typeof window !== "undefined") window.location.href = "/login";
  }
  if (!res.ok) {
    let msg = res.status >= 500 ? "Something went wrong. Try again." : "That didn't work";
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new ApiError(res.status, msg);
  }
  if (opts.raw) return res as unknown as T;
  return res.json() as Promise<T>;
}

export function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Save a transaction. If the phone is offline, it's queued in IndexedDB and
 * sent automatically when the connection comes back.
 */
export async function saveTransaction(body: Record<string, unknown>): Promise<{ queued: boolean; id?: string }> {
  const clientId = (body.clientId as string) || newClientId();
  const payload = { ...body, clientId };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await offlineDb().queue.add({ clientId, body: payload, createdAt: Date.now() });
    return { queued: true };
  }
  try {
    const r = await api<{ transaction: { id: string } }>("/api/transactions", { body: payload });
    return { queued: false, id: r.transaction.id };
  } catch (e) {
    if (e instanceof TypeError) {
      // Network failure mid-request
      await offlineDb().queue.add({ clientId, body: payload, createdAt: Date.now() });
      return { queued: true };
    }
    throw e;
  }
}

export async function pendingCount() {
  try { return await offlineDb().queue.count(); } catch { return 0; }
}

let flushing = false;
export async function flushQueue(): Promise<number> {
  if (flushing || (typeof navigator !== "undefined" && !navigator.onLine)) return 0;
  flushing = true;
  let sent = 0;
  try {
    const items = await offlineDb().queue.orderBy("createdAt").toArray();
    for (const it of items) {
      try {
        await api("/api/transactions", { body: it.body });
        await offlineDb().queue.delete(it.id!);
        sent++;
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) await offlineDb().queue.delete(it.id!); // invalid, drop it
        else break;
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}

/** Download a file from an API route (exports, backups). */
export async function download(path: string, fallbackName: string) {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) {
    let msg = "Export failed";
    try { msg = (await res.json()).error ?? msg; } catch {}
    throw new ApiError(res.status, msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? fallbackName;
  const file = new File([blob], name, { type: blob.type });
  // On iPhone the share sheet is the natural way to save/send a file.
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPhone|iPad/.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function haptic(ms = 8) {
  try { navigator.vibrate?.(ms); } catch {}
}

/** Sign out and wipe cached data on this device. */
export async function logout(to = "/login") {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
  try { navigator.serviceWorker?.controller?.postMessage("logout"); } catch {}
  try { (await import("dexie")).default.delete("pocket-offline"); } catch {}
  window.location.href = to;
}
