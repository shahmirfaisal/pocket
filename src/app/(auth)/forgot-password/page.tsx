"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/client";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      await api("/api/auth/forgot", { body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-[440px] flex-col gap-6 px-6 pb-9" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
      <Link href="/login" aria-label="Back" className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-card"><Icon name="back" /></Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.8px]">Reset password</h1>
        <p className="text-base leading-[1.45] text-muted">Enter the email you signed up with. We'll send you a link to choose a new password.</p>
      </div>
      <form onSubmit={send} className="flex flex-col gap-4">
        <Field label="Email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {error && <p role="alert" className="rounded-2xl bg-neg-bg px-4 py-3 text-sm font-semibold text-neg">{error}</p>}
        <Button type="submit" loading={busy}>Send reset link</Button>
      </form>
      {sent && (
        <section className="page-in flex items-start gap-3 rounded-[20px] bg-pos-bg p-4">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-card text-pos"><Icon name="mail" /></span>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-bold text-pos">Check your inbox</span>
            <span className="text-[13px] leading-[1.45] text-ink-2">If {email} has a Pocket account, a reset link is on its way. It expires in 30 minutes.</span>
            <button onClick={() => send()} className="mt-1 self-start text-[13px] font-bold text-pos underline">Resend email</button>
          </div>
        </section>
      )}
      <p className="mt-auto text-center text-sm text-muted">Remembered it? <Link href="/login" className="font-bold text-ink">Back to sign in</Link></p>
    </main>
  );
}
