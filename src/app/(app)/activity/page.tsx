"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { Button, Chip, CircleButton, Empty, Money, Page, Segmented, Sheet, Skeleton, TopBar } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TxGroups } from "@/components/tx";
import { useAccounts, useCategories, useTransactions, type TxFilters } from "@/lib/hooks";
import { monthRange, weekRange } from "@/lib/dates";
import { toMinor } from "@/lib/money";

function readFilters(sp: URLSearchParams): TxFilters {
  return {
    type: sp.get("type") || undefined,
    category: sp.get("category")?.split(",").filter(Boolean),
    account: sp.get("account")?.split(",").filter(Boolean),
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    q: sp.get("q") || undefined,
    min: Number(sp.get("min")) || undefined,
    max: Number(sp.get("max")) || undefined,
    subcategory: sp.get("subcategory") || undefined,
  };
}
function writeFilters(f: TxFilters) {
  const sp = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
    sp.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = sp.toString();
  return s ? `/activity?${s}` : "/activity";
}

function Activity() {
  const { user } = useApp();
  const router = useRouter();
  const sp = useSearchParams();
  const filters = useMemo(() => readFilters(new URLSearchParams(sp.toString())), [sp]);
  const [q, setQ] = useState(filters.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const query = useTransactions(filters);
  const txs = query.data?.pages.flatMap((p) => p.transactions) ?? [];
  const totals = query.data?.pages[0]?.totals;
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q) router.replace(writeFilters({ ...filters, q: q || undefined }), { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [q, filters, router]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage(), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [query]);

  const set = (patch: Partial<TxFilters>) => router.replace(writeFilters({ ...filters, ...patch }), { scroll: false });
  const extra = [filters.category?.length, filters.account?.length, filters.from, filters.min, filters.max, filters.subcategory].filter(Boolean).length;
  const filtered = extra > 0 || !!filters.type || !!filters.q;

  return (
    <Page>
      <TopBar large title="Activity" right={<CircleButton icon="calendar" label="Calendar view" href="/calendar" />} />
      <label className="flex h-[46px] items-center gap-2.5 rounded-[14px] bg-input px-3.5 text-muted">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, places, amounts" className="flex-1 bg-transparent text-ink outline-none placeholder:text-muted" />
      </label>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <Chip active={!filters.type} onClick={() => set({ type: undefined })}>All</Chip>
        <Chip active={filters.type === "expense"} onClick={() => set({ type: "expense" })}>Expenses</Chip>
        <Chip active={filters.type === "income"} onClick={() => set({ type: "income" })}>Income</Chip>
        <Chip active={filters.type === "transfer"} onClick={() => set({ type: "transfer" })}>Transfers</Chip>
        <Chip active={extra > 0} onClick={() => setShowFilters(true)}>Filters{extra ? ` · ${extra}` : ""}<Icon name="down" size={16} stroke={2} /></Chip>
      </div>

      {filtered && totals && (
        <div className="flex items-center justify-between rounded-[18px] bg-card px-4 py-3 text-[13px]">
          <span className="text-muted">{totals.count} {totals.count === 1 ? "transaction" : "transactions"}</span>
          <span className="flex gap-3 font-bold">
            {totals.expense > 0 && <Money value={-totals.expense} currency={user.currency} />}
            {totals.income > 0 && <Money value={totals.income} currency={user.currency} sign className="text-income" />}
          </span>
          {filtered && <button onClick={() => { setQ(""); router.replace("/activity"); }} className="font-bold">Clear</button>}
        </div>
      )}

      {query.isLoading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[66px] !rounded-[22px]" />)}</div>
      ) : txs.length === 0 ? (
        <Empty icon={filtered ? "search" : "receipt"} title={filtered ? "Nothing matches" : "No transactions yet"} body={filtered ? "Try a different search or clear the filters." : "Tap + to add your first one."} />
      ) : (
        <>
          <TxGroups txs={txs} currency={user.currency} tz={user.timezone} />
          <div ref={sentinel} className="flex h-10 items-center justify-center text-xs text-muted">{query.isFetchingNextPage ? "Loading…" : query.hasNextPage ? "" : "That's everything"}</div>
        </>
      )}

      {showFilters && <FiltersSheet value={filters} onApply={(f) => { set(f); setShowFilters(false); }} onClose={() => setShowFilters(false)} />}
    </Page>
  );
}

function FiltersSheet({ value, onApply, onClose }: { value: TxFilters; onApply: (f: TxFilters) => void; onClose: () => void }) {
  const { user } = useApp();
  const { data: catData } = useCategories();
  const { data: accData } = useAccounts();
  const [f, setF] = useState<TxFilters>(value);
  const [open, setOpen] = useState(true);
  const [min, setMin] = useState(value.min ? String(value.min / 100) : "");
  const [max, setMax] = useState(value.max ? String(value.max / 100) : "");
  const now = new Date();
  const ranges = {
    week: weekRange(now, user.timezone, user.weekStartsOn),
    month: monthRange(now, user.timezone, user.monthStartDay),
    last: monthRange(now, user.timezone, user.monthStartDay, -1),
  };
  const rangeKey = Object.entries(ranges).find(([, r]) => f.from === r.start.toISOString() && f.to === r.end.toISOString())?.[0] ?? (f.from ? "custom" : "any");
  const [custom, setCustom] = useState(rangeKey === "custom");
  const preview = useTransactions({ ...f, min: min ? toMinor(min) : undefined, max: max ? toMinor(max) : undefined, limit: 1 });
  const count = preview.data?.pages[0]?.totals?.count;
  const cats = (catData?.categories ?? []).filter((c) => !f.type || f.type === "transfer" || c.type === f.type);
  const toggle = (k: "category" | "account", id: string) => {
    const cur = f[k] ?? [];
    setF({ ...f, [k]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  };
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };

  return (
    <Sheet open={open} onOpenChange={close} title="Filters" top={70} left={<button onClick={() => { setF({}); setMin(""); setMax(""); setCustom(false); }} className="text-[15px] font-semibold text-muted">Reset</button>}>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">Type</span>
        <Segmented value={(f.type ?? "all") as string} onChange={(v) => setF({ ...f, type: v === "all" ? undefined : v })} options={[{ value: "all", label: "All" }, { value: "expense", label: "Expenses" }, { value: "income", label: "Income" }]} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">Date</span>
        <div className="flex flex-wrap gap-2">
          {([["any", "Any time"], ["week", "This week"], ["month", "This month"], ["last", "Last month"]] as const).map(([k, label]) => (
            <Chip key={k} active={!custom && rangeKey === k} onClick={() => { setCustom(false); if (k === "any") setF({ ...f, from: undefined, to: undefined }); else setF({ ...f, from: ranges[k].start.toISOString(), to: ranges[k].end.toISOString() }); }}>{label}</Chip>
          ))}
          <Chip active={custom} onClick={() => setCustom(true)}>Custom…</Chip>
        </div>
        {custom && (
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1 rounded-[14px] bg-card px-3.5 py-2"><span className="text-xs text-muted">From</span><input type="date" value={f.from?.slice(0, 10) ?? ""} onChange={(e) => setF({ ...f, from: e.target.value ? new Date(e.target.value + "T00:00").toISOString() : undefined })} className="bg-transparent font-semibold outline-none" /></label>
            <label className="flex flex-col gap-1 rounded-[14px] bg-card px-3.5 py-2"><span className="text-xs text-muted">To</span><input type="date" value={f.to ? new Date(new Date(f.to).getTime() - 1).toISOString().slice(0, 10) : ""} onChange={(e) => setF({ ...f, to: e.target.value ? new Date(new Date(e.target.value + "T00:00").getTime() + 86400000).toISOString() : undefined })} className="bg-transparent font-semibold outline-none" /></label>
          </div>
        )}
      </div>
      {f.type !== "transfer" && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-muted">Categories</span>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => {
              const on = f.category?.includes(c.id);
              return (
                <button key={c.id} aria-pressed={on} onClick={() => toggle("category", c.id)} className={clsx("tint flex h-9 items-center gap-1.5 rounded-full border-2 px-3 text-sm", on ? "border-ink font-bold" : "border-transparent font-semibold")} style={{ ["--c" as string]: on ? c.color : "#FFFFFF" }}>
                  {c.emoji} {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">Accounts</span>
        <div className="rounded-[18px] bg-card px-3.5">
          {(accData?.accounts ?? []).map((a) => (
            <button key={a.id} onClick={() => toggle("account", a.id)} className="flex w-full items-center border-b border-line py-3 text-left text-[15px] last:border-0">
              <span className={clsx("flex-1", f.account?.includes(a.id) && "font-semibold")}>{a.name}</span>
              {f.account?.includes(a.id) && <Icon name="check" stroke={2.4} />}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">Amount</span>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="flex h-12 items-center gap-1.5 rounded-[14px] bg-card px-3.5"><span className="text-muted">Min</span><input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Any" className="num min-w-0 flex-1 bg-transparent font-semibold outline-none" /></label>
          <label className="flex h-12 items-center gap-1.5 rounded-[14px] bg-card px-3.5"><span className="text-muted">Max</span><input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Any" className="num min-w-0 flex-1 bg-transparent font-semibold outline-none" /></label>
        </div>
      </div>
      <Button onClick={() => onApply({ ...f, q: value.q, min: min ? toMinor(min) : undefined, max: max ? toMinor(max) : undefined })}>
        {count === undefined ? "Show results" : `Show ${count} ${count === 1 ? "transaction" : "transactions"}`}
      </Button>
    </Sheet>
  );
}

export default function ActivityPage() {
  return <Suspense><Activity /></Suspense>;
}
