"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app";
import { Avatar, Card, CircleButton, IconTile, Money, Page, Row, Skeleton, TopBar, useToast } from "@/components/ui";
import { Icon, ACCOUNT_ICON } from "@/components/icons";
import { api } from "@/lib/client";
import { useAccounts, useAction, usePeople, useRecurring } from "@/lib/hooks";
import { ACCOUNT_META } from "@/lib/defaults";

export default function WalletsPage() {
  const { user, open } = useApp();
  const [showArchived, setShowArchived] = useState(false);
  const { data } = useAccounts(showArchived);
  const people = usePeople();
  const rec = useRecurring();
  const toast = useToast();
  const respond = useAction((v: { id: string; accept: boolean }) => api(`/api/invites/${v.id}`, { body: { accept: v.accept } }), { onSuccess: (_, v) => toast(v.accept ? "You joined the wallet" : "Invite declined") });
  const accounts = (data?.accounts ?? []).filter((a) => showArchived || !a.archived);
  const shared = accounts.filter((a) => a.shared);
  const own = accounts.filter((a) => !a.shared);
  const firstShared = shared[0];

  return (
    <Page>
      <TopBar
        large
        title="Wallets"
        sub={data ? <>Net worth <Money value={data.netWorth} currency={user.currency} /></> : " "}
        right={<><CircleButton icon="gear" label="Settings" href="/settings" /><CircleButton icon="plus" label="Add account" variant="ink" onClick={() => open("account", {})} /></>}
      />

      {data?.invites.map((i) => (
        <Card key={i.id} className="flex flex-col gap-3 p-4">
          <span className="flex items-center gap-3"><IconTile icon="users" color="#6B3FD6" /><span className="flex flex-col"><span className="text-[15px] font-bold">{i.from} invited you</span><span className="text-[13px] text-muted">Join “{i.name}” to track spending together</span></span></span>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => respond.mutate({ id: i.id, accept: false })} className="h-10 rounded-xl bg-chip text-sm font-bold">Decline</button>
            <button onClick={() => respond.mutate({ id: i.id, accept: true })} className="h-10 rounded-xl bg-ink text-sm font-bold text-bg">Join</button>
          </div>
        </Card>
      ))}

      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        {!data ? [0, 1, 2].map((i) => <div key={i} className="flex items-center gap-3 py-3"><Skeleton className="h-10 w-10" /><Skeleton className="h-4 flex-1" /></div>) : own.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">No accounts yet.</p>
        ) : own.map((a) => (
          <Row
            key={a.id}
            href={`/wallets/${a.id}`}
            icon={<IconTile icon={ACCOUNT_ICON[a.type] ?? "wallet"} color={a.color} />}
            title={<>{a.name}{a.archived && <span className="ml-1.5 text-xs font-medium text-muted">archived</span>}</>}
            sub={a.type === "credit" && a.creditDueDay ? `Credit card · due ${ordinal(a.creditDueDay)}` : ACCOUNT_META[a.type]?.label + (a.type === "bank" ? " account" : "")}
            right={<Money value={a.balance} currency={a.currency} className={a.balance < 0 ? "text-[15px] font-bold text-neg" : "text-[15px] font-bold"} />}
          />
        ))}
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href={firstShared ? `/wallets/${firstShared.id}` : "/wallets/shared"} className="pressable flex flex-col gap-3 rounded-[22px] bg-card p-4">
          <div className="flex">
            {firstShared ? [user.name, ...firstShared.members.filter((m) => m.status === "active").map((m) => m.name ?? m.email)].slice(0, 3).map((n, i) => (
              <span key={i} className={i ? "-ml-2.5" : ""}><Avatar name={n} size={32} ink={i === 0} color={["", "#EFE9FF", "#E6F6EE"][i]} /></span>
            )) : <IconTile icon="users" color="#6B3FD6" size={32} />}
          </div>
          <span className="flex flex-col gap-0.5"><span className="text-sm font-bold">{firstShared?.name ?? "Shared wallet"}</span><span className="text-xs text-muted">{firstShared ? `Shared · ${firstShared.members.filter((m) => m.status === "active").length + 1} members` : "Track spending with family"}</span></span>
        </Link>
        <Link href="/splits" className="pressable flex flex-col gap-3 rounded-[22px] bg-card p-4">
          <IconTile icon="split" color="#13824F" size={32} />
          <span className="flex flex-col gap-0.5"><span className="text-sm font-bold">Split bills</span>
            <span className="text-xs font-semibold text-pos">{people.data ? (people.data.owed ? <>You're owed <Money value={people.data.owed} currency={user.currency} /></> : people.data.owe ? <span className="text-neg">You owe <Money value={people.data.owe} currency={user.currency} /></span> : <span className="text-muted">All settled</span>) : " "}</span>
          </span>
        </Link>
      </div>

      {shared.length > 1 && (
        <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
          {shared.slice(1).map((a) => <Row key={a.id} href={`/wallets/${a.id}`} icon={<IconTile icon="users" color={a.color} />} title={a.name} sub={`Shared · ${a.members.length + 1} members`} right={<Money value={a.balance} currency={a.currency} className="font-bold" />} />)}
        </Card>
      )}

      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        <Row href="/recurring" icon={<Icon name="repeat" size={18} />} title="Recurring" right={<span className="text-[13px] text-muted">{rec.data ? `${rec.data.items.filter((i) => !i.paused).length} active` : ""}</span>} chevron />
        <Row href="/categories" icon={<Icon name="grid" size={18} />} title="Categories" chevron />
        <Row href="/settings/export" icon={<Icon name="download" size={18} />} title="Export & backup" chevron />
        <Row href="/settings/lock" icon={<Icon name="lock" size={18} />} title="App lock" right={<span className="text-[13px] text-muted">{user.lock.enabled ? (user.lock.faceId ? "Face ID" : "PIN") : "Off"}</span>} chevron />
      </Card>

      <button onClick={() => setShowArchived(!showArchived)} className="text-center text-[13px] font-semibold text-muted">{showArchived ? "Hide archived accounts" : "Show archived accounts"}</button>
    </Page>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
