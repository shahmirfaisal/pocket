"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { startAuthentication } from "@simplewebauthn/browser";
import { Icon } from "./icons";
import { api, ApiError, haptic, logout } from "@/lib/client";
import type { PublicUser } from "@/lib/types";

const HIDDEN_AT = "pocket_hidden_at";
const FRESH = "pocket_fresh_login";

function readNum(k: string) {
  try { return Number(sessionStorage.getItem(k) || 0); } catch { return 0; }
}

/** Privacy lock: covers the app on launch and after it's been in the background too long. */
export function LockGate({ user, children }: { user: PublicUser; children: ReactNode }) {
  const enabled = user.lock.enabled && user.lock.hasPin;
  // Start locked on the server and the client alike (so hydration matches), then
  // unlock before the first paint if this is a fresh sign-in or a quick return.
  const [locked, setLocked] = useState<boolean>(enabled);
  useLayoutEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem(FRESH)) { sessionStorage.removeItem(FRESH); setLocked(false); return; }
      const at = readNum(HIDDEN_AT);
      if (at && Date.now() - at < (user.lock.autoLockSec ?? 60) * 1000) setLocked(false);
    } catch {}
    // Only on mount: later locking is handled by the visibility listener below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [covered, setCovered] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try { sessionStorage.setItem(HIDDEN_AT, String(Date.now())); } catch {}
        setCovered(true);
      } else {
        const at = readNum(HIDDEN_AT);
        if (at && Date.now() - at >= (user.lock.autoLockSec ?? 60) * 1000) setLocked(true);
        setCovered(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onVis); };
  }, [enabled, user.lock.autoLockSec]);

  return (
    <>
      <div aria-hidden={locked || undefined} className={clsx(locked && "hidden")}>{children}</div>
      {enabled && covered && !locked && <div className="fixed inset-0 z-[200] bg-[#0B0C0F]" />}
      {enabled && locked && <LockScreen user={user} onUnlock={() => { setLocked(false); try { sessionStorage.removeItem(HIDDEN_AT); } catch {} }} />}
    </>
  );
}

export function markFreshLogin() {
  try { sessionStorage.setItem(FRESH, "1"); } catch {}
}

function LockScreen({ user, onUnlock }: { user: PublicUser; onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  const faceId = useCallback(async () => {
    setError(null);
    try {
      const options = await api<Parameters<typeof startAuthentication>[0]["optionsJSON"]>("/api/lock/passkey/auth");
      const resp = await startAuthentication({ optionsJSON: options });
      await api("/api/lock/passkey/auth", { body: resp });
      haptic(10);
      onUnlock();
    } catch (e) {
      const name = (e as Error).name;
      if (name === "NotAllowedError" || name === "AbortError") return; // user cancelled
      setError(e instanceof ApiError ? e.message : "Face ID didn't work. Use your PIN.");
    }
  }, [onUnlock]);

  useEffect(() => {
    // Try Face ID straight away where the browser allows it without a tap.
    if (user.lock.faceId && !tried.current && !/iPhone|iPad/.test(navigator.userAgent)) { tried.current = true; faceId(); }
  }, [faceId, user.lock.faceId]);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      await api("/api/lock/verify", { body: { pin: value } });
      haptic(10);
      onUnlock();
    } catch (e) {
      setShake(true);
      haptic(30);
      setTimeout(() => setShake(false), 400);
      setPin("");
      setError(e instanceof ApiError ? e.message : "Couldn't check your PIN");
      if (e instanceof ApiError && e.status === 401) setTimeout(() => (window.location.href = "/login"), 1200);
    } finally {
      setBusy(false);
    }
  };

  const key = (k: string) => {
    if (busy) return;
    haptic(4);
    setError(null);
    if (k === "del") return setPin((p) => p.slice(0, -1));
    setPin((p) => {
      const n = (p + k).slice(0, 4);
      if (n.length === 4) submit(n);
      return n;
    });
  };

  const forgot = async () => {
    await logout("/login?pin=1");
  };

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center overflow-y-auto bg-[#0B0C0F] px-8 text-[#F3F4F6]" style={{ paddingTop: "calc(env(safe-area-inset-top) + 56px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}>
      <div className="flex flex-col items-center gap-3.5">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#2A2E36] bg-[#1C1F25]">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#F3F4F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18" /><circle cx="16.5" cy="15" r="1.2" fill="#FF5A36" stroke="#FF5A36" /></svg>
        </div>
        <h1 className="text-2xl font-extrabold tracking-[-0.4px]">Pocket is locked</h1>
        <p className="text-[15px] text-[#9AA0AA]">Unlock to see your finances</p>
      </div>

      {user.lock.faceId && (
        <button onClick={faceId} className="pressable mt-7 flex h-[60px] w-full max-w-[340px] items-center justify-center gap-2.5 rounded-[20px] bg-[#F3F4F6] text-[17px] font-bold text-[#0B0C0F]">
          <Icon name="faceId" size={24} /> Unlock with Face ID
        </button>
      )}

      <div className="mt-7 flex flex-col items-center gap-4">
        <span className="text-sm text-[#9AA0AA]">{user.lock.faceId ? "or enter your PIN" : "Enter your PIN"}</span>
        <div className={clsx("flex gap-4", shake && "shake")} aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={clsx("h-3.5 w-3.5 rounded-full", i < pin.length ? "bg-[#F3F4F6]" : "border-2 border-[#5F6672]")} />
          ))}
        </div>
        <span className="min-h-[18px] text-center text-[13px] font-semibold text-[#FF8F73]">{error}</span>
      </div>

      <div className="mt-2 grid grid-cols-[repeat(3,76px)] gap-x-7 gap-y-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
          <button key={k} onClick={() => key(k)} className="h-[76px] w-[76px] rounded-full bg-[#1C1F25] text-[28px] font-medium active:bg-[#2A2E36]">{k}</button>
        ))}
        <span />
        <button onClick={() => key("0")} className="h-[76px] w-[76px] rounded-full bg-[#1C1F25] text-[28px] font-medium active:bg-[#2A2E36]">0</button>
        <button aria-label="Delete digit" onClick={() => key("del")} className="flex h-[76px] w-[76px] items-center justify-center rounded-full active:bg-[#1C1F25]"><Icon name="delKey" size={26} /></button>
      </div>

      <button onClick={forgot} className="mt-auto pt-6 text-sm font-semibold text-[#C9CDD4]">Forgot PIN? Sign in again</button>
    </div>
  );
}
