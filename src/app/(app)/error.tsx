"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">😵</span>
      <h1 className="text-2xl font-extrabold">Something went wrong</h1>
      <p className="text-sm text-muted">{error.message || "Try again in a moment."}</p>
      <button onClick={reset} className="mt-2 rounded-2xl bg-ink px-5 py-3 font-bold text-bg">Try again</button>
    </main>
  );
}
