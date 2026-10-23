"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { CatIcon, CircleButton, Empty, Money, Page, Segmented, Skeleton, TopBar, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/client";
import { useAction, useRecurring } from "@/lib/hooks";
import { dayKey, partsIn, MONTHS, WEEKDAYS } from "@/lib/dates";
import type { RecurringItem } from "@/lib/types";

function when(iso: string, tz: string) {
  const d = new Date(iso);
  const k = dayKey(d, tz);
  const today = dayKey(new Date(), tz);
  const tomorrow = dayKey(new Date(Date.now() + 86400000), tz);
  if (k < today) return { text: "Overdue", urgent: true };
  if (k === today) return { text: "Today", urgent: true };
  if (k === tomorrow) return { text: "Tomorrow", urgent: true };
  const p = partsIn(d, tz);
  return { text: `${WEEKDAYS[p.wd]} ${p.d} ${MONTHS[p.m - 1]}`, urgent: false };
}
const FREQ: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

function Recurring() {
  const { user, open } = useApp();
  const { data } = useRecurring();
  const [tab, setTab] = useState<"upcoming" | "subs" | "paused">("upcoming");
  const due = useSearchParams().get("due");
  const toast = useToast();
  const run = useAction((id: string) => api(`/api/recurring/${id}/run`, { method: "POST" }), {
    onSuccess: () => toast("Added"), onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't add", "error"),
  });
  const items = data?.items ?? [];
  const active = items.filter((i) => !i.paused);
  const week = Date.now() + 7 * 86400000;
  const shown = tab === "subs" ? active.filter((i) => i.subscription) : tab === "paused" ? items.filter((i) => i.paused) : active;

  const RowItem = ({ r }: { r: RecurringItem }) => {
    const w = when(r.nextDate, user.timezone);
    const isDue = new Date(r.nextDate).getTime() <= Date.now() + 3600_000 && r.mode === "ask";
    return (
      <div className={clsx("flex items-center gap-3 border-b border-line py-3 last:border-0", due === r.id && "bg-chip -mx-4 px-4")}>
        <button onClick={() => open("recurring", { edit: r.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <CatIcon emoji={r.emoji} color={r.type === "income" ? "#E6F6EE" : r.color} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{r.name}</span>
            <span className={clsx("truncate text-xs", w.urgent && !r.paused ? "font-semibold text-neg" : "text-muted")}>
              {r.paused ? "Paused" : w.text} · {FREQ[r.frequency]} · {r.mode === "auto" ? r.account.name : "Ask first"}
            </span>
          </span>
          <Money value={r.amount} currency={user.currency} sign={r.type === "income"} className={clsx("text-[15px] font-bold", r.type === "income" && "text-pos")} />
        </button>
        {isDue && <button onClick={() => run.mutate(r.id)} className="h-[34px] flex-none rounded-xl bg-ink px-3 text-[13px] font-bold text-bg">Add</button>}
      </div>
    );
  };

  return (
    <Page nav={false}>
      <TopBar back="/wallets" title="Recurring" right={<CircleButton icon="plus" label="Add recurring" variant="ink" onClick={() => open("recurring", {})} />} />
      <section className="num grid grid-cols-2 gap-3 rounded-3xl border bg-hero p-[18px] text-hero-ink" style={{ borderColor: "var(--hero-border)" }}>
        <div className="flex flex-col gap-1"><span className="text-[13px] text-hero-muted">Bills each month</span><Money value={data?.bills ?? 0} currency={user.currency} className="text-2xl font-extrabold" /></div>
        <div className="flex flex-col gap-1"><span className="text-[13px] text-hero-muted">Income each month</span><Money value={data?.income ?? 0} currency={user.currency} className="text-2xl font-extrabold text-[#7FD8A8]" /></div>
      </section>
      <Segmented value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Upcoming" }, { value: "subs", label: "Subscriptions" }, { value: "paused", label: "Paused" }]} />

      {!data ? <Skeleton className="h-40 !rounded-[22px]" /> : shown.length === 0 ? (
        <Empty icon="repeat" title={tab === "paused" ? "Nothing paused" : tab === "subs" ? "No subscriptions" : "Nothing recurring yet"} body="Add rent, salary, Netflix or any bill that repeats. Pocket logs it for you on the day." />
      ) : tab === "upcoming" ? (
        <>
          {shown.some((r) => new Date(r.nextDate).getTime() < week) && (
            <>
              <span className="-mb-2 px-1 text-[13px] font-semibold text-muted">Next 7 days</span>
              <div className="rounded-[22px] bg-card px-4 py-0.5">{shown.filter((r) => new Date(r.nextDate).getTime() < week).map((r) => <RowItem key={r.id} r={r} />)}</div>
            </>
          )}
          {shown.some((r) => new Date(r.nextDate).getTime() >= week) && (
            <>
              <span className="-mb-2 px-1 text-[13px] font-semibold text-muted">Later</span>
              <div className="rounded-[22px] bg-card px-4 py-0.5">{shown.filter((r) => new Date(r.nextDate).getTime() >= week).map((r) => <RowItem key={r.id} r={r} />)}</div>
            </>
          )}
        </>
      ) : (
        <div className="rounded-[22px] bg-card px-4 py-0.5">{shown.map((r) => <RowItem key={r.id} r={r} />)}</div>
      )}
    </Page>
  );
}

export default function RecurringPage() {
  return <Suspense><Recurring /></Suspense>;
}
