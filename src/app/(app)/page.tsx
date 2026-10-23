"use client";
import Link from "next/link";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { Avatar, Card, CircleButton, Money, Page, SectionTitle, Skeleton, useHide } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TxRow, timeLabel, dayLabel } from "@/components/tx";
import { useSummary } from "@/lib/hooks";
import { partsIn, WEEKDAYS } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function greeting(tz: string) {
  const h = partsIn(new Date(), tz).h;
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { user, open } = useApp();
  const { data, isLoading } = useSummary();
  const { hidden, toggle } = useHide();
  const tz = user.timezone;
  const cur = user.currency;

  return (
    <Page>
      <header className="flex items-center justify-between pt-2">
        <Link href="/settings" className="flex items-center gap-3">
          <Avatar name={user.name} ink size={44} />
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-muted">{data && !data.hasTransactions ? "Welcome to Pocket" : greeting(tz)}</span>
            <span className="text-[17px] font-bold">{user.name.split(" ")[0]}</span>
          </div>
        </Link>
        <CircleButton icon="bell" label="Notifications" href="/notifications" badge={!!data?.unread} />
      </header>

      <section className="flex flex-col gap-[18px] rounded-[28px] border bg-hero p-[22px] text-hero-ink" style={{ borderColor: "var(--hero-border)" }}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-hero-muted">Total balance</span>
          <button aria-label={hidden ? "Show amounts" : "Hide amounts"} onClick={toggle} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <Icon name={hidden ? "eyeOff" : "eye"} size={18} />
          </button>
        </div>
        {isLoading || !data ? <Skeleton className="h-10 w-56 !bg-white/10" /> : <Money value={data.total} currency={cur} className="text-[38px] font-extrabold leading-none tracking-[-1px]" />}
        {data && !data.hasTransactions ? (
          <span className="-mt-2 text-[13px] text-hero-muted">Across {data.accountNames.join(", ").replace(/, ([^,]*)$/, " and $1")}</span>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Income", value: data?.month.income ?? 0, icon: "arrowDownLeft" as const, c: "#8FB2FF" },
              { label: "Spent", value: data?.month.spent ?? 0, icon: "arrowUpRight" as const, c: "#FF8F73" },
            ].map((s) => (
              <Link key={s.label} href="/insights" className="flex flex-col gap-1.5 rounded-[18px] bg-white/[0.08] px-3.5 py-3">
                <span className="flex items-center gap-1.5 text-xs text-hero-muted">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full" style={{ color: s.c, background: `${s.c}2e` }}><Icon name={s.icon} size={13} stroke={2.4} /></span>
                  {s.label} · this month
                </span>
                <Money value={s.value} currency={cur} className="text-[17px] font-bold" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {data && !data.hasTransactions ? (
        <EmptyHome onAdd={() => open("add", {})} />
      ) : (
        <>
          <Card className="flex flex-col gap-3.5 p-[18px]">
            <div className="flex items-baseline justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-bold">This week</span>
                <span className="num text-xs text-muted">{data ? weekLine(data.week.total, data.week.lastWeek, cur, hidden) : " "}</span>
              </div>
              <Link href="/insights" className="text-[13px] font-semibold">Insights</Link>
            </div>
            <WeekBars days={data?.week.days} tz={tz} />
          </Card>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Quick add", icon: "bolt" as const, href: "/quick" },
              { label: "Scan receipt", icon: "camera" as const, href: "/scan" },
              { label: "Transfer", icon: "swap" as const, onClick: () => open("add", { type: "transfer" }) },
            ].map((a) =>
              a.href ? (
                <Link key={a.label} href={a.href} className="pressable flex flex-col items-center gap-1.5 rounded-[20px] bg-card py-3 text-xs font-semibold"><Icon name={a.icon} />{a.label}</Link>
              ) : (
                <button key={a.label} onClick={a.onClick} className="pressable flex flex-col items-center gap-1.5 rounded-[20px] bg-card py-3 text-xs font-semibold"><Icon name={a.icon} />{a.label}</button>
              )
            )}
          </div>

          <section className="flex flex-col gap-2.5">
            <SectionTitle action={<Link href="/activity" className="text-[13px] font-semibold">See all</Link>}>Recent</SectionTitle>
            <div className="mt-1 overflow-hidden rounded-3xl bg-card px-4 py-1.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
              {!data
                ? [0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3 py-3"><Skeleton className="h-[42px] w-[42px]" /><Skeleton className="h-4 flex-1" /></div>)
                : data.recent.map((t) => <TxRow key={t.id} t={t} currency={cur} showTime={dayLabel(t.date, tz) === "Today" ? timeLabel(t.date, tz) : dayLabel(t.date, tz)} />)}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

function weekLine(total: number, last: number, cur: string, hidden: boolean) {
  const spent = hidden ? "••••" : formatMoney(total, cur);
  if (!last) return `${spent} spent`;
  const pct = Math.round(((total - last) / last) * 100);
  if (pct === 0) return `${spent} spent · same as last week`;
  return `${spent} spent · ${Math.abs(pct)}% ${pct < 0 ? "less" : "more"} than last week`;
}

function WeekBars({ days, tz }: { days?: { date: string; total: number; future: boolean }[]; tz: string }) {
  const max = Math.max(1, ...(days ?? []).map((d) => d.total));
  const today = new Date().toDateString();
  return (
    <div className="grid h-[86px] grid-cols-7 items-end gap-2">
      {(days ?? Array.from({ length: 7 }, (_, i) => ({ date: "", total: 0, future: false, i }))).map((d, i) => {
        const isToday = d.date && new Date(d.date).toDateString() === today;
        const label = d.date ? WEEKDAYS[partsIn(new Date(d.date), tz).wd][0] : "";
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className={clsx("w-full rounded-lg transition-[height] duration-500", isToday ? "bg-accent" : d.future || !d.total ? "bg-chip" : "bg-seg")}
              style={{ height: d.total ? Math.max(8, (d.total / max) * 60) : 8 }}
            />
            <span className={clsx("text-[11px]", isToday ? "font-bold text-ink" : "text-muted")}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyHome({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <Card className="flex flex-col items-center gap-3 px-5 py-7 text-center">
        <span className="tint flex h-[72px] w-[72px] items-center justify-center rounded-3xl text-[#D9541E]" style={{ ["--c" as string]: "#FFF1E8" }}><Icon name="receipt" size={34} stroke={1.6} /></span>
        <span className="text-lg font-extrabold">No transactions yet</span>
        <span className="max-w-[260px] text-sm leading-[1.45] text-muted">Add your first expense — it takes two taps. Your charts and insights will appear here.</span>
        <button onClick={onAdd} className="pressable mt-1.5 flex h-12 items-center gap-2 rounded-2xl bg-accent px-[22px] text-[15px] font-bold text-white">
          <Icon name="plus" size={18} stroke={2.4} /> Add first expense
        </button>
      </Card>
      <section className="flex flex-col gap-2">
        <span className="px-1 text-[15px] font-bold">Get set up</span>
        {[
          { href: "/budgets?new=1", icon: "pie" as const, label: "Set a monthly budget" },
          { href: "/settings#notifications", icon: "bell" as const, label: "Turn on a daily reminder" },
          { href: "/settings/export", icon: "upload" as const, label: "Import from another app (CSV)" },
        ].map((r) => (
          <Link key={r.href} href={r.href} className="pressable flex items-center gap-3 rounded-[18px] bg-card px-3.5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name={r.icon} size={18} /></span>
            <span className="flex-1 text-sm font-semibold">{r.label}</span>
            <Icon name="chevron" size={16} className="text-muted" stroke={2} />
          </Link>
        ))}
      </section>
    </>
  );
}
