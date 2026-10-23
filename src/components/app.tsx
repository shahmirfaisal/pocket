"use client";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ConfirmProvider, HideProvider, ToastProvider, useToast } from "./ui";
import { Icon, type IconName } from "./icons";
import { api, flushQueue, haptic, pendingCount } from "@/lib/client";
import type { PublicUser } from "@/lib/types";
import { LockGate } from "./lock";
import { useAccounts, useCategories } from "@/lib/hooks";

// One loader per sheet, shared by the lazy component and the background warm-up below.
const SHEET_LOADERS = {
  add: () => import("./sheets/add"),
  account: () => import("./sheets/account"),
  budget: () => import("./sheets/budget"),
  recurring: () => import("./sheets/recurring"),
  category: () => import("./sheets/category"),
};
const AddSheet = dynamic(() => SHEET_LOADERS.add().then((m) => m.AddSheet), { ssr: false });
const AccountSheet = dynamic(() => SHEET_LOADERS.account().then((m) => m.AccountSheet), { ssr: false });
const BudgetSheet = dynamic(() => SHEET_LOADERS.budget().then((m) => m.BudgetSheet), { ssr: false });
const RecurringSheet = dynamic(() => SHEET_LOADERS.recurring().then((m) => m.RecurringSheet), { ssr: false });
const CategorySheet = dynamic(() => SHEET_LOADERS.category().then((m) => m.CategorySheet), { ssr: false });

export type AddProps = { type?: "expense" | "income" | "transfer"; edit?: string; account?: string; prefill?: { amount?: number; category?: string | null; subcategory?: string | null; note?: string; date?: string; receipt?: string | null; account?: string | null } };
export type Sheets = {
  add: AddProps;
  account: { edit?: string };
  budget: { edit?: string; mode?: "budget" | "goal"; goal?: string };
  recurring: { edit?: string };
  category: { edit?: string; type?: "expense" | "income" };
};
type SheetKind = keyof Sheets;

type AppCtx = {
  user: PublicUser;
  setUser: (u: PublicUser) => void;
  saveSettings: (patch: Record<string, unknown>) => Promise<void>;
  open: <K extends SheetKind>(kind: K, props?: Sheets[K]) => void;
};
const Ctx = createContext<AppCtx | null>(null);
export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppShell");
  return c;
}
export const useUser = () => useApp().user;

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true }, mutations: { retry: 0 } },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/activity", label: "Activity", icon: "list" },
  { href: "", label: "Add", icon: "plus" },
  { href: "/budgets", label: "Budgets", icon: "pie" },
  { href: "/wallets", label: "Wallets", icon: "wallet" },
];
const TAB_ROUTES = ["/", "/activity", "/budgets", "/wallets", "/insights"];

function TabBar({ onAdd }: { onAdd: () => void }) {
  const path = usePathname();
  if (!TAB_ROUTES.includes(path)) return null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 z-30 mx-auto grid h-[68px] max-w-[488px] grid-cols-5 items-center rounded-[34px] px-1.5 shadow-[var(--shadow)] backdrop-blur-xl"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)", background: "var(--nav)" }}
    >
      {TABS.map((t) =>
        t.href === "" ? (
          <button key="add" aria-label="Add transaction" onClick={() => { haptic(10); onAdd(); }} className="pressable flex h-14 w-14 items-center justify-center justify-self-center rounded-full bg-accent text-white shadow-[0_8px_20px_rgba(255,90,54,0.35)]">
            <Icon name="plus" size={26} stroke={2.4} />
          </button>
        ) : (
          <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined} className={clsx("flex flex-col items-center gap-[3px] text-[10px]", path === t.href || (t.href === "/" && path === "/insights") ? "font-semibold text-ink" : "font-medium text-muted")}>
            <Icon name={t.icon} size={22} stroke={path === t.href ? 2 : 1.8} />
            {t.label}
          </Link>
        )
      )}
    </nav>
  );
}

function themeCookie(theme: string) {
  document.cookie = `pocket_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

function OfflineSync() {
  const qc = useQueryClient();
  const toast = useToast();
  const [offline, setOffline] = useState(false);
  // Keep accounts and categories loaded at all times so the add sheet works offline.
  useAccounts();
  useCategories();
  useEffect(() => {
    const sync = async () => {
      setOffline(false);
      const n = await flushQueue();
      if (n) { toast(`Synced ${n} saved ${n === 1 ? "transaction" : "transactions"}`); qc.invalidateQueries(); }
    };
    const down = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", down);
    pendingCount().then((n) => { if (n && navigator.onLine) sync(); });
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", down); };
  }, [qc, toast]);
  if (!offline) return null;
  return (
    <div className="fixed inset-x-0 z-[60] flex justify-center" style={{ top: "calc(env(safe-area-inset-top) + 6px)" }}>
      <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-bg shadow-[var(--shadow)]">Offline — new expenses will sync later</span>
    </div>
  );
}

export function AppShell({ initialUser, children }: { initialUser: PublicUser; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const [hidden, setHidden] = useState(initialUser.hideAmounts);
  const [sheet, setSheet] = useState<{ kind: SheetKind; props: unknown; key: number } | null>(null);
  const toast = useToast();

  const saveSettings = useCallback(async (patch: Record<string, unknown>) => {
    const r = await api<{ user: PublicUser }>("/api/me", { method: "PATCH", body: patch });
    setUser(r.user);
    if ("theme" in patch) themeCookie(r.user.theme);
  }, []);

  const open = useCallback(<K extends SheetKind>(kind: K, props?: Sheets[K]) => setSheet({ kind, props: props ?? {}, key: Date.now() }), []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
    // Load the sheets' code in the background so + still works if the connection drops later.
    const warm = setTimeout(() => {
      for (const load of Object.values(SHEET_LOADERS)) void load().catch(() => {});
    }, 1500);
    // Keep this device in sync with the theme saved on the account (e.g. changed on another phone).
    const saved = document.cookie.match(/(?:^|; )pocket_theme=([^;]*)/)?.[1] ?? "auto";
    if (saved !== initialUser.theme) themeCookie(initialUser.theme);
    // Home Screen quick action / deep links: /?add=expense
    const sp = new URLSearchParams(window.location.search);
    const add = sp.get("add");
    if (add === "expense" || add === "income" || add === "transfer") open("add", { type: add });
    return () => clearTimeout(warm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hide = useMemo(
    () => ({
      hidden,
      toggle: () => {
        const v = !hidden;
        setHidden(v);
        haptic(6);
        api("/api/me", { method: "PATCH", body: { hideAmounts: v } }).catch(() => toast("Couldn't save that", "error"));
      },
    }),
    [hidden, toast]
  );

  const close = () => setSheet(null);
  const s = sheet;
  return (
    <Ctx.Provider value={{ user, setUser, saveSettings, open }}>
      <HideProvider value={hide}>
        <LockGate user={user}>
          {children}
          <TabBar onAdd={() => open("add", {})} />
          <OfflineSync />
          {s?.kind === "add" && <AddSheet key={s.key} {...(s.props as Sheets["add"])} onClose={close} />}
          {s?.kind === "account" && <AccountSheet key={s.key} {...(s.props as Sheets["account"])} onClose={close} />}
          {s?.kind === "budget" && <BudgetSheet key={s.key} {...(s.props as Sheets["budget"])} onClose={close} />}
          {s?.kind === "recurring" && <RecurringSheet key={s.key} {...(s.props as Sheets["recurring"])} onClose={close} />}
          {s?.kind === "category" && <CategorySheet key={s.key} {...(s.props as Sheets["category"])} onClose={close} />}
        </LockGate>
      </HideProvider>
    </Ctx.Provider>
  );
}

/** Opens/closes a sheet with a slide animation: mount open, then call onClose after the exit animation. */
export function useSheetOpen(onClose: () => void) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const set = useCallback((o: boolean) => {
    setOpen(o);
    if (!o) setTimeout(onClose, 320);
  }, [onClose]);
  return [open, set] as const;
}
