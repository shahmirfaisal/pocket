"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Field } from "@/components/ui";
import { api, ApiError } from "@/lib/client";
import { markFreshLogin } from "@/components/lock";
import { Logo } from "@/components/logo";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setError("The passwords don't match");
    setBusy(true); setError(null);
    try {
      await api("/api/auth/reset", { body: { token, password: pw } });
      markFreshLogin();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reset your password");
      setBusy(false);
    }
  };

  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-[440px] flex-col gap-6 px-6 pb-9" style={{ paddingTop: "calc(env(safe-area-inset-top) + 48px)" }}>
      <Logo />
      <div className="flex flex-col gap-2">
        <h1 className="text-[32px] font-extrabold leading-[1.1] tracking-[-0.8px]">Choose a new password</h1>
        <p className="text-base text-muted">You'll be signed out on your other devices.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="New password" type="password" autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
        <Field label="Type it again" type="password" autoComplete="new-password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        {error && <p role="alert" className="rounded-2xl bg-neg-bg px-4 py-3 text-sm font-semibold text-neg">{error}</p>}
        <Button type="submit" loading={busy} disabled={!token}>Save password</Button>
      </form>
    </main>
  );
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>;
}
