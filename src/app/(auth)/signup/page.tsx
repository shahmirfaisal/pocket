"use client";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { Button, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/client";
import { markFreshLogin } from "@/components/lock";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const LABELS = ["Too short", "Weak", "Okay", "Strong", "Very strong"];

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = strength(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return setError("Please accept the terms to continue");
    setBusy(true); setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/signup", { body: { name, email, password } });
      markFreshLogin();
      window.location.href = r.next;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't create your account");
      setBusy(false);
    }
  };

  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-[440px] flex-col gap-6 px-6 pb-9" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
      <Link href="/login" aria-label="Back" className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-card"><Icon name="back" /></Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.8px]">Create your account</h1>
        <p className="text-base text-muted">Start tracking in under a minute. It's free.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="flex flex-col gap-2">
          <Field label="Password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          {password && (
            <div className="flex items-center gap-2">
              <div className="grid flex-1 grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={clsx("h-1 rounded-full", i <= s ? (s <= 1 ? "bg-neg" : s === 2 ? "bg-warn" : "bg-pos") : "bg-seg")} />
                ))}
              </div>
              <span className="text-xs font-semibold text-muted">{LABELS[s]}</span>
            </div>
          )}
        </div>
        <label className="flex items-start gap-3 text-sm text-muted">
          <button type="button" role="checkbox" aria-checked={agree} onClick={() => setAgree(!agree)} className={clsx("mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2", agree ? "border-ink bg-ink text-bg" : "border-faint")}>
            {agree && <Icon name="check" size={14} stroke={3} />}
          </button>
          <span>I agree to keep my data private to me and accept Pocket's terms of use.</span>
        </label>
        {error && <p role="alert" className="rounded-2xl bg-neg-bg px-4 py-3 text-sm font-semibold text-neg">{error}</p>}
        <Button type="submit" loading={busy}>Create account</Button>
      </form>
      <p className="mt-auto text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-bold text-ink">Sign in</Link></p>
    </main>
  );
}
