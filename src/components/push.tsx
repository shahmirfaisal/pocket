"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export type PushState = "unsupported" | "needs-install" | "default" | "granted" | "denied";

/** Web push. On iPhone this only works once Pocket is added to the Home Screen. */
export function usePush() {
  const [state, setState] = useState<PushState>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(ios && !standalone ? "needs-install" : "unsupported");
      return;
    }
    setState(Notification.permission as PushState);
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((s) => setSubscribed(!!s)).catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    const perm = await Notification.requestPermission();
    setState(perm as PushState);
    if (perm !== "granted") return false;
    const { key } = await api<{ key: string | null }>("/api/push");
    if (!key) throw new Error("Push isn't configured on the server yet");
    const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) }));
    await api("/api/push", { body: sub.toJSON() });
    setSubscribed(true);
    return true;
  }, []);

  const disable = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api("/api/push", { method: "DELETE", body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  return { state, subscribed, enable, disable };
}
