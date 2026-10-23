"use client";
import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { Card, CatIcon, CircleButton, Money, Page, ProgressBar, SectionTitle, Skeleton, TopBar } from "@/components/ui";
import { TxGroups } from "@/components/tx";
import { api } from "@/lib/client";
import { useTransactions } from "@/lib/hooks";
import type { CategoryJSON } from "@/lib/types";

type Stats = {
  category: CategoryJSON;
  month: { total: number; prev: number; start: string; end: string };
  trend: { label: string; total: number; current: boolean }[];
  subcategories: { name: string; total: number; count: number }[];
  places: { name: string; total: number; count: number }[];
  budget: { id: string; spent: number; limit: number } | null;
};

export default function CategoryDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, open } = useApp();
  const { data } = useQuery({ queryKey: ["category", id], queryFn: () => api<Stats>(`/api/categories/${id}`) });
  const txs = useTransactions({ category: [id], from: data?.month.start, to: data?.month.end, limit: 30 }, !!data);
  const c = data?.category;
  const change = data && data.month.prev ? Math.round(((data.month.total - data.month.prev) / data.month.prev) * 100) : null;
  const max = Math.max(1, ...(data?.trend ?? []).map((t) => t.total));
  const pct = data?.budget ? Math.round((data.budget.spent / data.budget.limit) * 100) : 0;

  return (
    <Page nav={false}>
      <TopBar
        back="/insights"
        title={c ? <span className="flex items-center gap-3"><CatIcon emoji={c.emoji} color={c.color} size={40} />{c.name}</span> : " "}
        right={<CircleButton icon="edit" label="Edit category" onClick={() => open("category", { edit: id })} />}
      />
      {!data ? <Skeleton className="h-64 !rounded-3xl" /> : (
        <>
          <Card className="flex flex-col gap-3.5 !rounded-3xl p-[18px]">
            <div className="flex items-end justify-between">
              <div className="flex flex-col gap-1"><span className="text-[13px] text-muted">This month so far</span><Money value={data.month.total} currency={user.currency} className="text-[30px] font-extrabold tracking-[-0.8px]" /></div>
              {change !== null && change !== 0 && (
                <span className={clsx("num flex h-7 items-center rounded-full px-2.5 text-[13px] font-bold", change > 0 === (c?.type !== "income") ? "bg-neg-bg text-neg" : "bg-pos-bg text-pos")}>{change > 0 ? "↑" : "↓"} {Math.abs(change)}% vs last month</span>
              )}
            </div>
            {data.budget ? (
              <Link href="/budgets" className="flex flex-col gap-1.5">
                <ProgressBar value={data.budget.spent} max={data.budget.limit} color={pct >= 100 ? "#D6402A" : "var(--accent)"} height={10} />
                <span className="num text-[13px] text-muted">{pct}% of <Money value={data.budget.limit} currency={user.currency} /> budget · {data.budget.limit - data.budget.spent >= 0 ? <><Money value={data.budget.limit - data.budget.spent} currency={user.currency} /> left</> : <><Money value={data.budget.spent - data.budget.limit} currency={user.currency} /> over</>}</span>
              </Link>
            ) : c?.type === "expense" ? (
              <button onClick={() => open("budget", { mode: "budget" })} className="self-start text-[13px] font-bold text-accent">+ Set a budget for {c.name}</button>
            ) : null}
            <div className="num flex h-[120px] items-end gap-2 pt-1.5">
              {data.trend.map((t) => (
                <span key={t.label} className={clsx("flex flex-1 flex-col items-center gap-1.5 text-[11px] font-semibold", t.current ? "text-ink" : "text-muted")}>
                  <i className="block w-full rounded-lg" style={{ height: Math.max(6, (t.total / max) * 92), background: t.current ? "var(--accent)" : "color-mix(in srgb, var(--accent) 28%, var(--card))" }} />
                  {t.label}
                </span>
              ))}
            </div>
          </Card>

          {data.subcategories.length > 1 || (data.subcategories[0] && data.subcategories[0].name !== "Other") ? (
            <>
              <SectionTitle>Subcategories</SectionTitle>
              <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
                {data.subcategories.map((s) => (
                  <Link key={s.name} href={`/activity?category=${id}${s.name !== "Other" ? `&subcategory=${encodeURIComponent(s.name)}` : ""}`} className="num flex items-center gap-3 py-3 text-[15px]">
                    <span className="flex-1 font-semibold">{s.name}</span><span className="text-[13px] text-muted">{s.count} txns</span><Money value={s.total} currency={user.currency} className="font-bold" />
                  </Link>
                ))}
              </Card>
            </>
          ) : null}

          {data.places.length > 0 && (
            <>
              <SectionTitle>Top places</SectionTitle>
              <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
                {data.places.map((p) => (
                  <Link key={p.name} href={`/activity?category=${id}&q=${encodeURIComponent(p.name)}`} className="num flex items-center gap-3 py-3 text-[15px]">
                    <span className="flex-1 truncate font-semibold">{p.name}</span><span className="text-[13px] text-muted">{p.count}×</span><Money value={p.total} currency={user.currency} className="font-bold" />
                  </Link>
                ))}
              </Card>
            </>
          )}

          <SectionTitle action={<Link href={`/activity?category=${id}`} className="text-[13px] font-semibold">See all</Link>}>This month</SectionTitle>
          {txs.data && txs.data.pages[0].transactions.length === 0 ? <p className="px-1 text-sm text-muted">Nothing this month yet.</p> : <TxGroups txs={txs.data?.pages.flatMap((p) => p.transactions) ?? []} currency={user.currency} tz={user.timezone} />}
        </>
      )}
    </Page>
  );
}
