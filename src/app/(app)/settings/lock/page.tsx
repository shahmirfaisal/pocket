"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { startRegistration } from "@simplewebauthn/browser";
import { useApp } from "@/components/app";
import { Card, Page, Sheet, Toggle, TopBar, useHide, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError, haptic } from "@/lib/client";
import type { PublicUser } from "@/lib/types";

const TIMES = [
  { sec: 0, label: "Immediately" },
  { sec: 60, label: "After 1 minute" },
  { sec: 300, label: "After 5 minutes" },
  { sec: 900, label: "After 15 minutes" },
  { sec: 3600, label: "After 1 hour" },
];

function LockSettings() {
  const { user, setUser, saveSettings } = useApp();
  const hide = useHide();
  const toast = useToast();
  const sp = useSearchParams();
  const [pinFlow, setPinFlow] = useState<null | "set" | "change" | "off">(null);
  const [faceBusy, setFaceBusy] = useState(false);
  const [supportsPasskey, setSupportsPasskey] = useState(true);

  useEffect(() => {
    if (sp.get("reset")) setPinFlow("set");
    const pk = window.PublicKeyCredential as unknown as { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } | undefined;
    pk?.isUserVerifyingPlatformAuthenticatorAvailable?.().then(setSupportsPasskey).catch(() => setSupportsPasskey(false));
    if (!pk) setSupportsPasskey(false);
  }, [sp]);

  const reload = async () => setUser((await api<{ user: PublicUser }>("/api/me")).user);

  const toggleLock = (on: boolean) => {
    if (!on) return setPinFlow("off");
    if (!user.lock.hasPin) return setPinFlow("set");
    saveSettings({ lock: { enabled: true, faceId: user.lock.faceId, autoLockSec: user.lock.autoLockSec } });
  };

  const toggleFace = async (on: boolean) => {
    if (!on) return saveSettings({ lock: { enabled: user.lock.enabled, autoLockSec: user.lock.autoLockSec, faceId: false } });
    setFaceBusy(true);
    try {
      const options = await api<Parameters<typeof startRegistration>[0]["optionsJSON"]>("/api/lock/passkey/register");
      const resp = await startRegistration({ optionsJSON: options });
      await api("/api/lock/passkey/register", { body: resp });
      await reload();
      haptic(12);
      toast("Face ID is on");
    } catch (e) {
      const n = (e as Error).name;
      if (n === "InvalidStateError") {
        // A passkey for this device already exists — just switch it back on.
        await saveSettings({ lock: { enabled: user.lock.enabled, autoLockSec: user.lock.autoLockSec, faceId: true } });
        toast("Face ID is on");
      } else if (n !== "NotAllowedError" && n !== "AbortError") toast(e instanceof ApiError ? e.message : "Face ID couldn't be set up here", "error");
    } finally {
      setFaceBusy(false);
    }
  };

  return (
    <Page nav={false}>
      <TopBar back="/settings" title="App lock" />
      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        <div className="flex items-center gap-3 py-3.5">
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Lock Pocket</span><span className="text-xs text-muted">Ask to unlock when you open the app</span></span>
          <Toggle label="Lock Pocket" checked={user.lock.enabled} onChange={toggleLock} />
        </div>
        <div className={clsx("flex items-center gap-3 py-3.5", !user.lock.enabled && "opacity-50")}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="faceId" /></span>
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Unlock with Face ID</span>{!supportsPasskey && <span className="text-xs text-muted">Not available in this browser</span>}</span>
          <Toggle label="Unlock with Face ID" checked={user.lock.faceId} disabled={!user.lock.enabled || faceBusy || (!supportsPasskey && !user.lock.faceId)} onChange={toggleFace} />
        </div>
        <button disabled={!user.lock.hasPin} onClick={() => setPinFlow("change")} className="flex w-full items-center gap-3 py-3.5 text-left disabled:opacity-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="dots" /></span>
          <span className="flex-1 text-[15px] font-semibold">Change PIN</span>
          <Icon name="chevron" size={16} stroke={2} className="text-muted" />
        </button>
      </Card>

      <span className="-mb-2 px-1 text-[13px] font-semibold text-muted">Lock after leaving the app</span>
      <Card className={clsx("px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line", !user.lock.enabled && "opacity-50")}>
        {TIMES.map((t) => (
          <button key={t.sec} disabled={!user.lock.enabled} onClick={() => saveSettings({ lock: { enabled: true, faceId: user.lock.faceId, autoLockSec: t.sec } })} className={clsx("flex w-full items-center py-3.5 text-left text-[15px]", user.lock.autoLockSec === t.sec && "font-semibold")}>
            <span className="flex-1">{t.label}</span>{user.lock.autoLockSec === t.sec && <Icon name="check" stroke={2.4} />}
          </button>
        ))}
      </Card>

      <Card className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Hide amounts by default</span><span className="text-xs text-muted">Show •••• until you tap the eye icon</span></span>
        <Toggle label="Hide amounts by default" checked={hide.hidden} onChange={() => hide.toggle()} />
      </Card>

      <p className="px-1 text-xs leading-relaxed text-muted">App lock keeps people who pick up your unlocked phone out of Pocket. Face ID uses a passkey stored on this iPhone. If you forget your PIN, sign in with your password to set a new one.</p>

      {pinFlow && pinFlow !== "off" && <PinFlow mode={pinFlow} onDone={async () => { setPinFlow(null); await reload(); toast(pinFlow === "set" ? "App lock is on" : "PIN changed"); }} onClose={() => setPinFlow(null)} />}
      {pinFlow === "off" && <TurnOff onDone={async () => { setPinFlow(null); await reload(); toast("App lock is off"); }} onClose={() => setPinFlow(null)} />}
    </Page>
  );
}

function Dots({ n, shake }: { n: number; shake?: boolean }) {
  return <div className={clsx("flex justify-center gap-4", shake && "shake")}>{[0, 1, 2, 3].map((i) => <span key={i} className={clsx("h-3.5 w-3.5 rounded-full", i < n ? "bg-ink" : "border-2 border-faint")} />)}</div>;
}

function Pad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="mx-auto grid grid-cols-[repeat(3,72px)] gap-x-6 gap-y-3">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((k, i) =>
        k === "" ? <span key={i} /> : (
          <button key={i} aria-label={k === "del" ? "Delete digit" : k} onClick={() => { haptic(4); onKey(k); }} className={clsx("flex h-[72px] w-[72px] items-center justify-center rounded-full text-[26px] font-medium", k === "del" ? "" : "bg-card active:bg-seg")}>
            {k === "del" ? <Icon name="delKey" size={24} /> : k}
          </button>
        )
      )}
    </div>
  );
}

function PinFlow({ mode, onDone, onClose }: { mode: "set" | "change"; onDone: () => void; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<"current" | "new" | "confirm">(mode === "change" ? "current" : "new");
  const [current, setCurrent] = useState("");
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  const fail = (msg: string) => { setError(msg); setShake(true); haptic(30); setTimeout(() => setShake(false), 400); setPin(""); };

  const complete = async (value: string) => {
    if (step === "current") { setCurrent(value); setPin(""); setStep("new"); return; }
    if (step === "new") { setFirst(value); setPin(""); setStep("confirm"); return; }
    if (value !== first) { setStep("new"); return fail("PINs didn't match. Try again."); }
    try {
      await api("/api/lock/pin", { body: { pin: value, current: current || undefined } });
      setOpen(false);
      setTimeout(onDone, 300);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { setStep("current"); setCurrent(""); return fail(e.message); }
      fail(e instanceof ApiError ? e.message : "Couldn't save the PIN");
    }
  };
  const key = (k: string) => {
    setError(null);
    if (k === "del") return setPin(pin.slice(0, -1));
    const n = (pin + k).slice(0, 4);
    setPin(n);
    if (n.length === 4) setTimeout(() => complete(n), 120);
  };
  const title = step === "current" ? "Enter your current PIN" : step === "new" ? "Choose a 4-digit PIN" : "Type it again";
  return (
    <Sheet open={open} onOpenChange={close} title={mode === "set" ? "Set up app lock" : "Change PIN"} top={60}>
      <div className="flex flex-col items-center gap-5 py-6">
        <span className="text-lg font-bold">{title}</span>
        <Dots n={pin.length} shake={shake} />
        <span className="min-h-[18px] text-[13px] font-semibold text-neg">{error}</span>
      </div>
      <Pad onKey={key} />
    </Sheet>
  );
}

function TurnOff({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  const key = async (k: string) => {
    setError(null);
    if (k === "del") return setPin(pin.slice(0, -1));
    const n = (pin + k).slice(0, 4);
    setPin(n);
    if (n.length === 4) {
      try { await api("/api/lock/pin", { method: "DELETE", body: { pin: n } }); setOpen(false); setTimeout(onDone, 300); }
      catch (e) { setPin(""); setError(e instanceof ApiError ? e.message : "Wrong PIN"); }
    }
  };
  return (
    <Sheet open={open} onOpenChange={close} title="Turn off app lock" top={60}>
      <div className="flex flex-col items-center gap-5 py-6"><span className="text-lg font-bold">Enter your PIN</span><Dots n={pin.length} /><span className="min-h-[18px] text-[13px] font-semibold text-neg">{error}</span></div>
      <Pad onKey={key} />
    </Sheet>
  );
}

export default function LockPage() {
  return <Suspense><LockSettings /></Suspense>;
}
