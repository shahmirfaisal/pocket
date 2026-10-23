export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-2xl font-extrabold">You're offline</h1>
      <p className="text-muted">Pocket will load as soon as you're back online. Expenses you add offline are saved and synced later.</p>
    </main>
  );
}
