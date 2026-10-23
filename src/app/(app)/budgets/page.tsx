"use client";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { Card, CatIcon, CircleButton, Empty, Money, Page, ProgressBar, SectionTitle, Skeleton, TopBar } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBudgets } from "@/lib/hooks";
import { formatMoney } from "@/lib/money";

function Budgets() {
  const { user, open } = useApp();
  const { data } = useBudgets();
  const sp = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (sp.get("new")) { open("budget", { mode: sp.get("new") === "goal" ? "goal" : "budget" }); router.replace("/budgets"); }
  }, [sp, open, router]);
  const o = data?.overall;
  const pct = o ? Math.min(100, Math.round((o.spent / Math.max(1, o.limit)) * 100)) : 0;
  const r = 44, c = 2 * Math.PI * r;
  const cur = user.currency;

  return (
    <Page>
      <TopBar large title="Budgets" right={<CircleButton icon="plus" label="New budget" variant="ink" onClick={() => open("budget", { mode: "budget" })} />} />

      {!data ? <Skeleton className="h-36 !rounded-3xl" /> : !o && data.budgets.length === 0 ? (
        <Empty icon="pie" title="No budgets yet" body="Set a monthly limit for everything, or for the categories you want to keep an eye on." action={<button onClick={() => open("budget", { mode: "budget" })} className="pressable mt-1 h-12 rounded-2xl bg-ink px-5 text-[15px] font-bold text-bg">Create a budget</button>} />
      ) : o ? (
        <button onClick={() => o.id && open("budget", { edit: o.id })} className="flex items-center gap-[18px] rounded-3xl bg-card p-[18px] text-left">
          <div className="relative h-[104px] w-[104px] flex-none">
            <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${pct}% of budget used`} className="-rotate-90">
              <circle cx="52" cy="52" r={r} fill="none" stroke="var(--chip)" strokeWidth="12" />
              <circle cx="52" cy="52" r={r} fill="none" stroke={o.spent > o.limit ? "#D6402A" : "var(--ink)"} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
            </svg>
            <span className="num absolute inset-0 flex items-center justify-center text-[22px] font-extrabold">{pct}%</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-muted">{o.summed ? "All budgets this month" : "Monthly budget"}</span>
            <span className="num text-[22px] font-extrabold tracking-[-0.4px]"><Money value={o.spent} currency={cur} /> <span className="text-sm font-medium text-muted">/ <Money value={o.limit} currency={cur} compact /></span></span>
            <span className={clsx("num text-[13px] font-semibold", o.limit - o.spent >= 0 ? "text-pos" : "text-neg")}>
              {o.limit - o.spent >= 0 ? <><Money value={o.limit - o.spent} currency={cur} /> left</> : <><Money value={o.spent - o.limit} currency={cur} /> over</>} · {data.daysLeft} {data.daysLeft === 1 ? "day" : "days"} to go
            </span>
          </div>
        </button>
      ) : (
        <button onClick={() => open("budget", { mode: "budget" })} className="flex items-center gap-3 rounded-[22px] border-[1.5px] border-dashed border-faint p-4 text-left text-sm font-semibold"><Icon name="plus" size={18} />Add an overall monthly budget</button>
      )}

      {data && data.budgets.length > 0 && (
        <Card className="flex flex-col !rounded-3xl px-[18px] py-1.5">
          {data.budgets.map((b) => {
            const p = b.limit ? b.spent / b.limit : 0;
            const over = b.spent > b.limit;
            return (
              <button key={b.id} onClick={() => open("budget", { edit: b.id! })} className="flex flex-col gap-2 border-b border-line py-3.5 text-left last:border-0">
                <div className="flex items-center gap-2.5">
                  <CatIcon emoji={b.category!.emoji} color={b.category!.color} size={32} radius={11} />
                  <span className="flex-1 text-[15px] font-semibold">{b.category!.name}{b.period !== "monthly" && <span className="ml-1.5 text-xs font-medium text-muted">{b.period}</span>}</span>
                  <span className={clsx("num text-[13px] font-bold", over ? "text-[#D6402A]" : p >= 0.8 ? "text-[#B4481D]" : "text-muted")}>{over ? `${formatMoney(b.spent - b.limit, cur)} over` : `${Math.round(p * 100)}% used`}</span>
                </div>
                <ProgressBar value={b.spent} max={b.limit} color={over ? "#D6402A" : p >= 0.8 ? "#FF5A36" : "var(--ink)"} track={over ? "#F6D9D3" : undefined} />
                <span className="num text-xs text-muted"><Money value={b.spent} currency={cur} /> of <Money value={b.limit} currency={cur} />{b.rollover ? " · rolls over" : ""}</span>
              </button>
            );
          })}
        </Card>
      )}

      <SectionTitle action={<button onClick={() => open("budget", { mode: "goal" })} className="text-[13px] font-semibold">+ New goal</button>}>Savings goals</SectionTitle>
      <div className="mt-1 grid grid-cols-2 gap-2.5">
        {(data?.goals ?? []).map((g, i) => {
          const p = Math.min(100, (g.saved / g.target) * 100);
          const dark = i === 0;
          return (
            <Link key={g.id} href={`/goals/${g.id}`} className={clsx("pressable flex flex-col gap-2.5 rounded-[22px] p-4", dark ? "bg-hero text-hero-ink" : "bg-card")}>
              <span className={clsx("flex items-center gap-1.5 text-[13px]", dark ? "text-hero-muted" : "text-muted")}>{g.emoji} {g.name}</span>
              <span className="num text-lg font-extrabold"><Money value={g.saved} currency={cur} compact /> <span className={clsx("text-xs font-medium", dark ? "text-hero-muted" : "text-muted")}>/ <Money value={g.target} currency={cur} compact /></span></span>
              <div className={clsx("h-1.5 rounded-full", dark ? "bg-white/15" : "bg-chip")}><div className={clsx("h-full rounded-full", dark ? "bg-[#34C77B]" : "bg-pos")} style={{ width: `${p}%` }} /></div>
            </Link>
          );
        })}
        {data && data.goals.length === 0 && (
          <button onClick={() => open("budget", { mode: "goal" })} className="col-span-2 flex items-center gap-3 rounded-[22px] bg-card p-4 text-left">
            <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-chip text-xl">🎯</span>
            <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Save up for something</span><span className="text-xs text-muted">A laptop, a trip, an emergency fund…</span></span>
            <Icon name="plus" size={18} />
          </button>
        )}
      </div>
    </Page>
  );
}

export default function BudgetsPage() {
  return <Suspense><Budgets /></Suspense>;
}
