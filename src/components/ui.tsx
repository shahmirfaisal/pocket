"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drawer } from "vaul";
import clsx from "clsx";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { formatMoney } from "@/lib/money";
import { haptic } from "@/lib/client";

/* ---------- Layout ---------- */

export function Page({ children, className, nav = true }: { children: ReactNode; className?: string; nav?: boolean }) {
  return (
    <main className={clsx("page-in mx-auto flex min-h-dvh w-full max-w-[520px] flex-col gap-4 px-5 pt-safe", nav ? "pb-[128px]" : "pb-10", className)} style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
      {children}
    </main>
  );
}

export function TopBar({ title, back, right, large, sub }: { title?: ReactNode; back?: string | true; right?: ReactNode; large?: boolean; sub?: ReactNode }) {
  const router = useRouter();
  return (
    <header className={clsx("flex items-center gap-3", large ? "pt-3" : "pt-2")}>
      {back && (
        <button
          aria-label="Back"
          onClick={() => (typeof back === "string" && window.history.length <= 1 ? router.push(back) : window.history.length > 1 ? router.back() : router.push(typeof back === "string" ? back : "/"))}
          className="pressable flex h-11 w-11 flex-none items-center justify-center rounded-full bg-card"
        >
          <Icon name="back" />
        </button>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title && <h1 className={clsx("m-0 truncate font-extrabold", large ? "text-[32px] tracking-[-0.8px]" : "text-[22px] tracking-[-0.4px]")}>{title}</h1>}
        {sub && <span className="num text-[13px] text-muted">{sub}</span>}
      </div>
      {right && <div className="flex flex-none items-center gap-2">{right}</div>}
    </header>
  );
}

export function CircleButton({ icon, label, href, onClick, variant = "card", size = 44, badge }: { icon: IconName; label: string; href?: string; onClick?: () => void; variant?: "card" | "ink" | "chip"; size?: number; badge?: boolean }) {
  const cls = clsx(
    "pressable relative flex flex-none items-center justify-center rounded-full",
    variant === "ink" ? "bg-ink text-bg" : variant === "chip" ? "bg-seg text-ink" : "bg-card text-ink"
  );
  const inner = (
    <>
      <Icon name={icon} size={size > 40 ? 20 : 16} stroke={variant === "ink" ? 2.4 : 1.9} />
      {badge && <span className="absolute right-3 top-[11px] h-2 w-2 rounded-full border-2 border-card bg-accent" />}
    </>
  );
  if (href) return <Link href={href} aria-label={label} className={cls} style={{ width: size, height: size }}>{inner}</Link>;
  return <button aria-label={label} onClick={onClick} className={cls} style={{ width: size, height: size }}>{inner}</button>;
}

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section className={clsx("rounded-[22px] bg-card", className)} {...rest}>{children}</section>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="-mb-1.5 flex items-baseline justify-between px-1">
      <span className="text-[15px] font-bold">{children}</span>
      {action}
    </div>
  );
}
export function Label({ children }: { children: ReactNode }) {
  return <span className="-mb-1.5 px-1 text-[13px] font-semibold text-muted">{children}</span>;
}

export function List({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={clsx("px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line", className)}>{children}</Card>;
}

export function Row({
  icon, title, sub, right, href, onClick, chevron, danger, className,
}: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; right?: ReactNode; href?: string; onClick?: () => void; chevron?: boolean; danger?: boolean; className?: string }) {
  const inner = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className={clsx("truncate text-[15px] font-semibold", danger && "text-neg")}>{title}</span>
        {sub && <span className="truncate text-xs text-muted">{sub}</span>}
      </span>
      {right}
      {chevron && <Icon name="chevron" size={16} className="flex-none text-muted" stroke={2} />}
    </>
  );
  const cls = clsx("flex w-full items-center gap-3 py-3", (href || onClick) && "active:opacity-60", className);
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

/* ---------- Atoms ---------- */

const HideCtx = createContext<{ hidden: boolean; toggle: () => void }>({ hidden: false, toggle: () => {} });
export const HideProvider = HideCtx.Provider;
export const useHide = () => useContext(HideCtx);

export function Money({ value, currency = "PKR", sign, compact, className, color }: { value: number; currency?: string; sign?: boolean; compact?: boolean; className?: string; color?: boolean }) {
  const { hidden } = useHide();
  const text = hidden ? `${formatMoney(0, currency).split(" ")[0]} ••••` : formatMoney(value, currency, { sign, compact });
  return <span className={clsx("num whitespace-nowrap", color && value > 0 && "text-income", className)}>{text}</span>;
}

export function TxAmount({ type, amount, currency, className }: { type: string; amount: number; currency?: string; className?: string }) {
  const v = type === "expense" ? -amount : amount;
  return <Money value={v} currency={currency} sign={type === "income"} className={clsx("font-bold", type === "income" && "text-income", type === "transfer" && "text-muted", className)} />;
}

export function CatIcon({ emoji, color, size = 40, radius }: { emoji: string; color?: string; size?: number; radius?: number }) {
  return (
    <span className="tint flex flex-none items-center justify-center" style={{ width: size, height: size, borderRadius: radius ?? size * 0.33, ["--c" as string]: color ?? "#F1F2F4", fontSize: size * 0.45 }}>
      {emoji}
    </span>
  );
}

export function IconTile({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  return (
    <span className="flex flex-none items-center justify-center" style={{ width: size, height: size, borderRadius: size * 0.33, color, background: `color-mix(in srgb, ${color} 14%, var(--card))` }}>
      <Icon name={icon} size={size * 0.5} />
    </span>
  );
}

export function Avatar({ name, color, size = 40, ink }: { name: string; color?: string; size?: number; ink?: boolean }) {
  return (
    <span
      className={clsx("flex flex-none items-center justify-center rounded-full font-bold", ink ? "bg-ink text-bg" : "tint text-ink-2")}
      style={{ width: size, height: size, fontSize: size * 0.38, ["--c" as string]: color ?? "#E9F0FF" }}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export function Segmented<T extends string>({ options, value, onChange, className, size = "md" }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className={clsx("grid rounded-[14px] bg-seg p-[3px]", className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => { haptic(5); onChange(o.value); }}
          className={clsx(
            "rounded-[11px] px-2 font-semibold transition-all",
            size === "sm" ? "h-[30px] text-[13px]" : "h-9 text-sm",
            o.value === value ? "bg-card font-bold text-ink shadow-[0_1px_3px_rgba(17,19,24,0.12)]" : "text-muted"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => { haptic(6); onChange(!checked); }}
      className={clsx("relative h-[31px] w-[51px] flex-none rounded-full p-0 transition-colors duration-200 disabled:opacity-50", checked ? "bg-[#34C759]" : "bg-seg")}
    >
      <span className={clsx("absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200", checked ? "translate-x-[22px]" : "translate-x-[2px]")} />
    </button>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={() => { haptic(4); onClick?.(); }}
      aria-pressed={active}
      className={clsx("pressable flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm", active ? "bg-ink font-bold text-bg" : "bg-card font-semibold text-ink", className)}
    >
      {children}
    </button>
  );
}

export function Button({
  children, onClick, variant = "primary", className, loading, disabled, type = "button", href, size = "lg",
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "accent" | "secondary" | "danger" | "ghost"; className?: string; loading?: boolean; disabled?: boolean; type?: "button" | "submit"; href?: string; size?: "md" | "lg" }) {
  const cls = clsx(
    "pressable flex items-center justify-center gap-2 rounded-[18px] font-bold disabled:opacity-50",
    size === "lg" ? "h-14 text-[17px]" : "h-12 rounded-2xl text-[15px]",
    variant === "primary" && "bg-ink text-bg",
    variant === "accent" && "bg-accent text-white",
    variant === "secondary" && "bg-card text-ink",
    variant === "danger" && "bg-neg-bg text-neg",
    variant === "ghost" && "bg-transparent text-ink",
    className
  );
  const content = loading ? <Spinner /> : children;
  if (href) return <Link href={href} className={cls}>{content}</Link>;
  return <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>{content}</button>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-current border-t-transparent", className)} aria-label="Loading" />;
}

export function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <input {...rest} className={clsx("h-[54px] rounded-2xl border-2 border-transparent bg-card px-4 text-base outline-none transition-colors focus:border-ink", rest.className)} />
    </label>
  );
}

export function ProgressBar({ value, max, color = "var(--ink)", track = "var(--chip)", height = 8 }: { value: number; max: number; color?: string; track?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="overflow-hidden rounded-full" style={{ height, background: track }}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton", className)} />;
}

export function Empty({ icon = "receipt", title, body, action }: { icon?: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-3 px-5 py-7 text-center">
      <span className="tint flex h-[72px] w-[72px] items-center justify-center rounded-3xl text-[#D9541E]" style={{ ["--c" as string]: "#FFF1E8" }}>
        <Icon name={icon} size={34} stroke={1.6} />
      </span>
      <span className="text-lg font-extrabold">{title}</span>
      {body && <span className="max-w-[270px] text-sm leading-[1.45] text-muted">{body}</span>}
      {action}
    </Card>
  );
}

/* ---------- Sheet ---------- */

export function Sheet({
  open, onOpenChange, title, children, left, right, top = 56, nested, className,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode; left?: ReactNode; right?: ReactNode; top?: number; nested?: boolean; className?: string }) {
  const Root = nested ? Drawer.NestedRoot : Drawer.Root;
  return (
    <Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40" />
        <Drawer.Content
          aria-describedby={undefined}
          className={clsx("fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[520px] flex-col rounded-t-[28px] bg-bg outline-none", className)}
          style={{ top: `calc(${top}px + env(safe-area-inset-top))` }}
        >
          <span aria-hidden className="mx-auto mt-2.5 h-[5px] w-10 flex-none rounded-full bg-faint/50" />
          <div className="flex flex-none items-center justify-between px-5 pb-2 pt-3">
            <div className="min-w-[60px]">{left}</div>
            <Drawer.Title className="text-[17px] font-extrabold">{title}</Drawer.Title>
            <div className="flex min-w-[60px] justify-end">
              {right === undefined ? (
                <button aria-label="Close" onClick={() => onOpenChange(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-seg">
                  <Icon name="close" size={14} stroke={2.6} />
                </button>
              ) : right}
            </div>
          </div>
          <div className="no-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2" data-vaul-no-drag="">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Root>
  );
}

/* ---------- Toasts & confirm ---------- */

type Toast = { id: number; text: string; tone: "ok" | "error" | "info" };
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const id = useRef(0);
  const push = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    const t = { id: ++id.current, text, tone };
    setToasts((x) => [...x.slice(-2), t]);
    if (tone === "error") haptic(20);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== t.id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-5" style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}>
        {toasts.map((t) => (
          <div key={t.id} role="status" className={clsx("page-in pointer-events-auto flex max-w-[440px] items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-[var(--shadow)]", t.tone === "error" ? "bg-neg text-white" : "bg-ink text-bg")}>
            <Icon name={t.tone === "error" ? "warning" : t.tone === "info" ? "info" : "check"} size={16} stroke={2.2} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

type ConfirmOpts = { title: string; body?: string; confirm: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]" onClick={() => close(false)}>
          <div className="page-in flex w-full max-w-[460px] flex-col gap-2" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={state.title}>
            <div className="overflow-hidden rounded-[18px] bg-card">
              <div className="flex flex-col gap-1 px-4 py-4 text-center">
                <span className="text-[15px] font-bold">{state.title}</span>
                {state.body && <span className="text-[13px] leading-snug text-muted">{state.body}</span>}
              </div>
              <button onClick={() => close(true)} className={clsx("h-14 w-full border-t border-line text-[17px] font-semibold active:bg-chip", state.danger ? "text-neg" : "text-ink")}>{state.confirm}</button>
            </div>
            <button onClick={() => close(false)} className="h-14 rounded-[18px] bg-card text-[17px] font-bold active:bg-chip">Cancel</button>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

/* ---------- Number pad ---------- */

export function Keypad({ onKey, dark }: { onKey: (k: string) => void; dark?: boolean }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];
  return (
    <div className="num grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          aria-label={k === "del" ? "Delete digit" : k}
          onClick={() => { haptic(4); onKey(k); }}
          className={clsx("flex h-[52px] items-center justify-center rounded-[14px] text-2xl font-medium active:bg-seg", dark ? "bg-transparent" : "bg-transparent")}
        >
          {k === "del" ? <Icon name="delKey" size={24} /> : k}
        </button>
      ))}
    </div>
  );
}

/** Applies a keypad key to an amount string like "1250.5". */
export function applyKey(cur: string, k: string) {
  if (k === "del") return cur.slice(0, -1);
  if (k === ".") return cur.includes(".") ? cur : (cur || "0") + ".";
  if (cur.includes(".") && cur.split(".")[1].length >= 2) return cur;
  if (cur === "0") return k;
  if (cur.replace(".", "").length >= 11) return cur;
  return cur + k;
}

export function amountDisplay(s: string) {
  if (!s) return "0";
  const [i, d] = s.split(".");
  const int = Number(i || "0").toLocaleString("en-US");
  return d !== undefined ? `${int}.${d}` : int;
}
