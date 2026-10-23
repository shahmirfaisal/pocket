"use client";
import Link from "next/link";
import { useEffect } from "react";
import clsx from "clsx";
import { Card, Empty, Page, Skeleton, TopBar, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { usePush } from "@/components/push";
import { api } from "@/lib/client";
import { useAction, useNotifications } from "@/lib/hooks";
import type { NotificationRow } from "@/lib/types";

const KIND: Record<string, { icon: IconName; c: string }> = {
  budget: { icon: "warning", c: "#D9541E" },
  recurring: { icon: "repeat", c: "#2F5BEA" },
  shared: { icon: "users", c: "#6B3FD6" },
  split: { icon: "check", c: "#13824F" },
  goal: { icon: "target", c: "#9A6B00" },
  reminder: { icon: "bell", c: "#111318" },
  info: { icon: "info", c: "#5F6672" },
};

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return new Intl.DateTimeFormat("en", { weekday: "short" }).format(new Date(iso));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(iso));
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const readAll = useAction(() => api("/api/notifications", { body: { all: true } }));
  const push = usePush();
  const toast = useToast();
  const list = data?.notifications ?? [];
  const today = list.filter((n) => Date.now() - new Date(n.createdAt).getTime() < 86400000);
  const week = list.filter((n) => Date.now() - new Date(n.createdAt).getTime() >= 86400000);

  useEffect(() => {
    // Mark as read a moment after opening so the dots are seen first.
    if (!list.some((n) => !n.read)) return;
    const t = setTimeout(() => readAll.mutate(undefined), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <Page nav={false}>
      <TopBar back="/" title="Notifications" right={list.some((n) => !n.read) && <button onClick={() => readAll.mutate(undefined)} className="text-sm font-bold">Mark all read</button>} />

      {push.state !== "granted" && push.state !== "unsupported" && (
        <Card className="flex items-center gap-3 !bg-hero p-4 text-hero-ink">
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-bold">{push.state === "needs-install" ? "Add Pocket to your Home Screen" : "Get alerts on your phone"}</span>
            <span className="text-[13px] text-hero-muted">{push.state === "needs-install" ? "iPhone only sends app notifications once Pocket is on the Home Screen. Tap Share → Add to Home Screen." : push.state === "denied" ? "Notifications are blocked. Turn them on in iPhone Settings → Pocket." : "Budget alerts, bills due and a daily nudge."}</span>
          </span>
          {push.state === "default" && (
            <button onClick={() => push.enable().then((ok) => ok && toast("Notifications on")).catch((e) => toast(e.message, "error"))} className="h-9 rounded-xl bg-white px-3.5 text-[13px] font-bold text-[#111318]">Turn on</button>
          )}
        </Card>
      )}

      {isLoading ? <Skeleton className="h-40 !rounded-[22px]" /> : list.length === 0 ? (
        <Empty icon="bell" title="You're all caught up" body="Budget alerts, upcoming bills and shared wallet activity will show up here." />
      ) : (
        <>
          {today.length > 0 && <Group title="Today" items={today} />}
          {week.length > 0 && <Group title="Earlier" items={week} />}
        </>
      )}

      <Card className="flex items-center gap-3 !bg-hero p-4 text-hero-ink">
        <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-bold">Daily reminder</span><span className="text-[13px] text-hero-muted">A nudge to log today's spending</span></span>
        <Link href="/settings#notifications" className="flex h-9 items-center rounded-xl bg-white px-3.5 text-[13px] font-bold text-[#111318]">Change</Link>
      </Card>
    </Page>
  );
}

function Group({ title, items }: { title: string; items: NotificationRow[] }) {
  return (
    <>
      <span className="-mb-2 px-1 text-[13px] font-semibold text-muted">{title}</span>
      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        {items.map((n) => {
          const k = KIND[n.kind] ?? KIND.info;
          const inner = (
            <>
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px]" style={{ color: k.c === "#111318" ? "var(--ink)" : k.c, background: `color-mix(in srgb, ${k.c} 12%, var(--card))` }}><Icon name={k.icon} /></span>
              <span className="flex flex-1 flex-col gap-[3px]"><span className={clsx("text-[15px]", n.read ? "font-semibold" : "font-bold")}>{n.title}</span>{n.body && <span className="text-[13px] leading-[1.4] text-muted">{n.body}</span>}</span>
              <span className="flex flex-col items-end gap-1.5"><span className="text-xs text-muted">{ago(n.createdAt)}</span>{!n.read && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-accent" />}</span>
            </>
          );
          return n.link ? <Link key={n.id} href={n.link} className="flex gap-3 py-3.5">{inner}</Link> : <div key={n.id} className="flex gap-3 py-3.5">{inner}</div>;
        })}
      </Card>
    </>
  );
}
