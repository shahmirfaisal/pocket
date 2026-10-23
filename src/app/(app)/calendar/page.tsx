"use client";
import { useState } from "react";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { CircleButton, Empty, Money, Page, Skeleton, TopBar } from "@/components/ui";
import { TxRow } from "@/components/tx";
import { useCalendar, useTransactions } from "@/lib/hooks";
import { MONTHS, MONTHS_LONG, WEEKDAYS, partsIn, zoned } from "@/lib/dates";

export default function CalendarPage() {
  const { user } = useApp();
  const tz = user.timezone;
  const now = partsIn(new Date(), tz);
  const [ym, setYm] = useState({ y: now.y, m: now.m });
  const { data } = useCalendar(`${ym.y}-${ym.m}`);
  const [selected, setSelected] = useState<string>(`${now.y}-${String(now.m).padStart(2, "0")}-${String(now.d).padStart(2, "0")}`);
  const [sy, sm, sd] = selected.split("-").map(Number);
  const from = zoned(sy, sm, sd, tz), to = zoned(sy, sm, sd + 1, tz);
  const dayTx = useTransactions({ from: from.toISOString(), to: to.toISOString(), limit: 100 });
  const txs = dayTx.data?.pages.flatMap((p) => p.transactions) ?? [];

  const days = data ? Object.entries(data.days) : [];
  const max = Math.max(1, ...days.map(([, d]) => d.spent));
  const shift = (n: number) => setYm(({ y, m }) => { const mm = m + n; return { y: y + Math.floor((mm - 1) / 12), m: ((mm - 1 + 120) % 12) + 1 }; });
  const lead = data ? (data.firstWeekday - user.weekStartsOn + 7) % 7 : 0;
  const heads = user.weekStartsOn === 1 ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];
  const monthTotal = days.reduce((s, [, d]) => s + d.spent, 0);
  const shade = (v: number) => (v <= 0 ? undefined : v / max > 0.66 ? "#F8C7B1" : v / max > 0.33 ? "#FBE0D3" : "#FDF0EA");
  const isFuture = (k: string) => data && k > data.today;
  const selTotal = data?.days[selected]?.spent ?? 0;

  return (
    <Page nav={false}>
      <TopBar
        back="/activity"
        title={`${MONTHS_LONG[ym.m - 1]} ${ym.y}`}
        sub={data ? <>Spent <Money value={monthTotal} currency={user.currency} /></> : " "}
        right={<><CircleButton icon="back" label="Previous month" onClick={() => shift(-1)} size={36} /><CircleButton icon="chevron" label="Next month" onClick={() => shift(1)} size={36} /></>}
      />
      <section className="flex flex-col gap-1.5 rounded-3xl bg-card px-3 py-3.5">
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">{heads.map((h, i) => <span key={i}>{h}</span>)}</div>
        {!data ? (
          <Skeleton className="h-[260px]" />
        ) : (
          <div className="num grid grid-cols-7 gap-1">
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {days.map(([k, d]) => {
              const day = Number(k.slice(-2));
              const sel = k === selected;
              const bg = shade(d.spent);
              return (
                <button
                  key={k}
                  onClick={() => setSelected(k)}
                  aria-current={k === data.today ? "date" : undefined}
                  aria-pressed={sel}
                  className={clsx("flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold", sel ? "bg-ink text-bg" : isFuture(k) ? "text-faint" : "", !sel && k === data.today && "ring-2 ring-ink")}
                  style={!sel && bg ? { background: `color-mix(in srgb, ${bg} var(--heat-mix), var(--card))` } : undefined}
                >
                  {day}
                  {!isFuture(k) && <i className={clsx("text-[9px] font-semibold not-italic", sel ? "text-[#FFB59E]" : "text-muted")}>{d.spent ? short(d.spent) : "—"}</i>}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex items-baseline justify-between px-1">
        <span className="text-[15px] font-bold">{dayLabelFor(selected, tz)}</span>
        {selTotal > 0 && <Money value={-selTotal} currency={user.currency} className="text-sm font-bold text-muted" />}
      </div>
      {dayTx.isLoading ? <Skeleton className="h-20 !rounded-[22px]" /> : txs.length ? (
        <div className="-mt-1 overflow-hidden rounded-[22px] bg-card px-4 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
          {txs.map((t) => <TxRow key={t.id} t={t} currency={user.currency} />)}
        </div>
      ) : (
        <Empty icon="calendar" title="Nothing on this day" />
      )}
      <div className="flex items-center gap-2 px-1 text-xs text-muted">
        <span>Less</span>
        {["#FDF0EA", "#FBE0D3", "#F8C7B1"].map((c) => <span key={c} className="h-2.5 w-4 rounded-[3px]" style={{ background: `color-mix(in srgb, ${c} var(--heat-mix), var(--card))` }} />)}
        <span>More spending</span>
      </div>
    </Page>
  );
}

function short(minor: number) {
  const v = minor / 100;
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(Math.round(v));
}

function dayLabelFor(key: string, tz: string) {
  const [y, m, d] = key.split("-").map(Number);
  const p = partsIn(zoned(y, m, d, tz, 12), tz);
  return `${WEEKDAYS[p.wd]}, ${p.d} ${MONTHS[p.m - 1]}`;
}
