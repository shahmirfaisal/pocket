import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">🧭</span>
      <h1 className="text-2xl font-extrabold">Nothing here</h1>
      <p className="text-muted">That page doesn't exist.</p>
      <Link href="/" className="mt-2 rounded-2xl bg-ink px-5 py-3 font-bold text-bg">Go home</Link>
    </main>
  );
}
