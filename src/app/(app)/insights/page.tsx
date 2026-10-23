"use client";
import Link from "next/link";
import { useState } from "react";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { CatIcon, CircleButton, Empty, Money, Page, Segmented, Skeleton, TopBar, useHide } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useInsights } from "@/lib/hooks";
import { MONTHS_LONG, partsIn, addDays } from "@/lib/dates";

// Strong colours for the chart, picked to stay distinct next to each other
const PALETTE = ["#FF5A36", "#7A3FD1", "#2F5BEA", "#C2335C", "#13824F", "#A66A00", "#0E7490", "#9AA0AA"];

export default function InsightsPage() {
  const { user } = useApp();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [offset, setOffset] = useState(0);
  const { data } = useInsights(period, offset);
  const { hidden } = useHide();
  const tz = user.timezone;

  const label = (() => {
    if (!data) return " ";
    const s = partsIn(new Date(data.range.start), tz);
    if (period === "year") return String(s.y);
    if (period === "month") return `${MONTHS_LONG[s.m - 1]} ${s.y}`;
    const e = partsIn(addDays(new Date(data.range.end), -1, tz), tz);
    return `${s.d} ${MONTHS_LONG[s.m - 1].slice(0, 3)} – ${e.d} ${MONTHS_LONG[e.m - 1].slice(0, 3)}`;
  })();
  const change = data && data.prevSpent ? Math.round(((data.spent - data.prevSpent) / data.prevSpent) * 100) : null;
  const top = data?.categories.slice(0, 7) ?? [];
  const rest = data?.categories.slice(7).reduce((s, c) => s + c.total, 0) ?? 0;
  const slices = [...top.map((c, i) => ({ ...c, color: PALETTE[i] })), ...(rest ? [{ id: null, name: "Other", emoji: "✨", total: rest, count: 0, color: PALETTE[7] }] : [])];

  return (
    <Page>
      <TopBar large title="Insights" right={<CircleButton icon="download" label="Export report" href="/settings/export" />} />
      <Segmented value={period} onChange={(p) => { setPeriod(p); setOffset(0); }} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />

      <div className="flex items-center justify-between">
        <CircleButton icon="back" label="Previous" size={36} onClick={() => setOffset(offset - 1)} />
        <span className="text-[15px] font-bold">{label}</span>
        <CircleButton icon="chevron" label="Next" size={36} onClick={() => offset < 0 && setOffset(offset + 1)} />
      </div>

      <section className="flex flex-col gap-4 rounded-3xl bg-card p-[18px]">
        {!data ? <Skeleton className="h-[180px]" /> : data.spent === 0 ? (
          <div className="py-8 text-center text-sm text-muted">No spending in this period.</div>
        ) : (
          <div className="flex items-center gap-5">
            <Donut slices={slices} total={data.spent} currency={user.currency} hidden={hidden} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {slices.slice(0, 5).map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: s.color }} />
                  <span className="flex-1 truncate font-medium">{s.name}</span>
                  <span className="num font-semibold text-muted">{Math.round((s.total / data.spent) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {data && (
          <div className="grid grid-cols-3 gap-2 border-t border-line pt-3.5 text-center">
            <Stat label="Spent" value={<Money value={data.spent} currency={user.currency} compact />} />
            <Stat label="Income" value={<Money value={data.income} currency={user.currency} compact />} />
            <Stat label="Per day" value={<Money value={data.dailyAverage} currency={user.currency} compact />} />
          </div>
        )}
        {change !== null && (
          <span className={clsx("-mt-1 text-center text-xs font-semibold", change > 0 ? "text-neg" : "text-pos")}>
            {change === 0 ? "Same as" : `${change > 0 ? "↑" : "↓"} ${Math.abs(change)}% vs`} the previous {period}
          </span>
        )}
      </section>

      {data?.insight && (
        <Link href={`/categories/${data.insight.categoryId}`} className="tint flex items-start gap-3 rounded-[20px] px-4 py-3.5" style={{ ["--c" as string]: "#FFF1E8" }}>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-card text-[#D9541E]"><Icon name="sparkle" /></span>
          <span className="flex flex-col gap-[3px]"><span className="text-sm font-bold">{data.insight.title}</span><span className="text-[13px] leading-[1.4] text-ink-2">{hidden ? "Tap to see what changed." : data.insight.body}</span></span>
        </Link>
      )}

      <section className="flex flex-col gap-3.5 rounded-3xl bg-card p-[18px]">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold">Last 6 {period}s</span>
          {data && <span className="num text-xs text-muted">Avg <Money value={Math.round(data.trend.reduce((s, t) => s + t.total, 0) / 6)} currency={user.currency} compact /> / {period}</span>}
        </div>
        <div className="grid h-[130px] grid-cols-6 items-end gap-2.5">
          {(data?.trend ?? Array.from({ length: 6 }, () => ({ label: "", total: 0, current: false }))).map((t, i, arr) => {
            const max = Math.max(1, ...arr.map((x) => x.total));
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className="num text-[10px] font-semibold text-muted">{t.total && !hidden ? <Money value={t.total} currency={user.currency} compact className="!text-[10px]" /> : ""}</span>
                <div className={clsx("w-full rounded-lg transition-[height] duration-500", t.current ? "bg-ink" : "bg-seg")} style={{ height: Math.max(6, (t.total / max) * 90) }} />
                <span className={clsx("text-[11px]", t.current ? "font-bold" : "text-muted")}>{t.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <span className="-mb-1.5 px-1 text-[15px] font-bold">By category</span>
      {data && data.categories.length === 0 ? <Empty icon="pie" title="Nothing yet" body="Your spending by category shows up here." /> : (
        <div className="rounded-[22px] bg-card px-4 py-0.5">
          {(data?.categories ?? []).map((c, i) => {
            const inner = (
              <>
                <CatIcon emoji={c.emoji} color={c.color} size={38} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex justify-between text-[15px]"><span className="truncate font-semibold">{c.name}</span><Money value={c.total} currency={user.currency} className="font-bold" /></span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-chip"><span className="block h-full rounded-full" style={{ width: `${(c.total / (data?.spent || 1)) * 100}%`, background: PALETTE[Math.min(i, 7)] }} /></span>
                </span>
              </>
            );
            return c.id ? <Link key={c.name} href={`/categories/${c.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0">{inner}</Link> : <div key={c.name} className="flex items-center gap-3 border-b border-line py-3 last:border-0">{inner}</div>;
          })}
        </div>
      )}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex flex-col gap-0.5"><span className="text-xs text-muted">{label}</span><span className="text-[15px] font-bold">{value}</span></div>;
}

function Donut({ slices, total, currency, hidden }: { slices: { name: string; total: number; color: string }[]; total: number; currency: string; hidden: boolean }) {
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative h-[136px] w-[136px] flex-none">
      <svg viewBox="0 0 136 136" className="h-full w-full -rotate-90" role="img" aria-label="Spending by category">
        <circle cx="68" cy="68" r={r} fill="none" stroke="var(--chip)" strokeWidth="16" />
        {slices.map((s) => {
          const len = (s.total / total) * c;
          const gap = slices.length > 1 ? 2 : 0;
          const el = <circle key={s.name} cx="68" cy="68" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc} />;
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] text-muted">Spent</span>
        <Money value={total} currency={currency} compact className={clsx("text-lg font-extrabold", hidden && "text-base")} />
      </div>
    </div>
  );
}
