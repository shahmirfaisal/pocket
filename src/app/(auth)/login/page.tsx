"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button, Field } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/client";
import { markFreshLogin } from "@/components/lock";
import { Logo } from "@/components/logo";


function LoginForm() {
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/login", { body: { email, password } });
      markFreshLogin();
      window.location.href = sp.get("pin") ? "/settings/lock?reset=1" : r.next;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Check your connection.");
      setBusy(false);
    }
  };

  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-[440px] flex-col gap-6 px-6 pb-9" style={{ paddingTop: "calc(env(safe-area-inset-top) + 48px)" }}>
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.8px]">Welcome back</h1>
        <p className="text-base text-muted">{sp.get("pin") ? "Sign in with your password, then choose a new PIN." : "Sign in to see where your money went."}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="flex flex-col gap-2">
          <div className="flex justify-between">
            <label htmlFor="pw" className="text-[13px] font-semibold text-ink-2">Password</label>
            <Link href="/forgot-password" className="text-[13px] font-semibold">Forgot?</Link>
          </div>
          <div className="relative">
            <input id="pw" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="h-[54px] w-full rounded-2xl border-2 border-transparent bg-card px-4 pr-12 outline-none focus:border-ink" />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted">
              <Icon name={show ? "eyeOff" : "eye"} />
            </button>
          </div>
        </div>
        {error && <p role="alert" className="rounded-2xl bg-neg-bg px-4 py-3 text-sm font-semibold text-neg">{error}</p>}
        <Button type="submit" loading={busy} className="mt-2">Sign in</Button>
      </form>
      <p className="mt-auto text-center text-sm text-muted">New to Pocket? <Link href="/signup" className="font-bold text-ink">Create account</Link></p>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
