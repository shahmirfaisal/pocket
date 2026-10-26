"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app";
import { Avatar, Button, Card, CircleButton, Empty, Field, Keypad, Money, Page, SectionTitle, Sheet, Skeleton, TopBar, amountDisplay, applyKey, useConfirm, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TxGroups } from "@/components/tx";
import { api, ApiError } from "@/lib/client";
import { useQueryClient } from "@tanstack/react-query";
import { refreshAfterDelete, useAccount, useAction, useCategories, useTransactions } from "@/lib/hooks";
import { ACCOUNT_META } from "@/lib/defaults";
import { symbolFor } from "@/lib/money";

export default function WalletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  if (id === "shared") return <SharedIntro />;
  return <Wallet id={id} />;
}

function SharedIntro() {
  const { open } = useApp();
  return (
    <Page nav={false}>
      <TopBar back="/wallets" title="Shared wallets" />
      <Empty icon="users" title="Track money together" body="Open any account and tap Invite to share it with family or a partner. Everyone sees and adds spending in real time." action={<Button size="md" className="mt-1 px-6" onClick={() => open("account", {})}>Create a new account</Button>} />
      <Link href="/wallets" className="text-center text-sm font-semibold text-muted">Or pick an existing account</Link>
    </Page>
  );
}

function Wallet({ id }: { id: string }) {
  const { user, open } = useApp();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error } = useAccount(id);
  const txs = useTransactions({ account: [id] });
  const [sheet, setSheet] = useState<null | "invite" | "adjust">(null);
  const qc = useQueryClient();
  const a = data?.account;

  if (error) return <Page nav={false}><TopBar back="/wallets" /><Empty icon="wallet" title="Account not found" /></Page>;
  if (!a) return <Page nav={false}><TopBar back="/wallets" /><Skeleton className="h-52 !rounded-[28px]" /><Skeleton className="h-24 !rounded-[22px]" /></Page>;

  const list = txs.data?.pages.flatMap((p) => p.transactions) ?? [];
  const series = data.series;
  const min = Math.min(...series), max = Math.max(...series);
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * 318},${56 - ((v - min) / Math.max(1, max - min)) * 48 + 4}`).join(" L");
  const members = data.members;
  const totalSpent = members.reduce((s, m) => s + m.spent, 0);
  const COLORS = ["var(--ink)", "#9B6BFF", "#34C77B", "#FF8F73", "#2F5BEA"];

  return (
    <Page nav={false}>
      <TopBar
        back="/wallets"
        title={a.shared ? a.name : undefined}
        right={a.isOwner ? <button onClick={() => open("account", { edit: id })} className="pressable h-11 rounded-full bg-card px-[18px] text-[15px] font-bold">Edit</button> : null}
      />
      <section className="flex flex-col gap-[18px] rounded-[28px] p-5 text-white" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${a.color} 75%, #000), ${a.color})` }}>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold opacity-85">{a.name} · {ACCOUNT_META[a.type]?.label}{a.shared ? " · Shared" : ""}</span>
          <Money value={a.balance} currency={a.currency} className="text-4xl font-extrabold tracking-[-1px]" />
          <span className="num text-[13px] opacity-85"><Money value={data.month.in} currency={a.currency} sign /> in · <Money value={-data.month.out} currency={a.currency} /> out this month</span>
        </div>
        <div className="grid grid-cols-4">
          {[
            { label: "Add", icon: "plus" as const, onClick: () => open("add", { account: id }) },
            { label: "Transfer", icon: "swap" as const, onClick: () => open("add", { type: "transfer", account: id }) },
            { label: "Adjust", icon: "edit" as const, onClick: () => setSheet("adjust") },
            { label: a.shared || a.isOwner ? "Invite" : "Filter", icon: (a.shared || a.isOwner ? "users" : "filter") as "users", onClick: () => (a.isOwner ? setSheet("invite") : router.push(`/activity?account=${id}`)) },
          ].map((x) => (
            <button key={x.label} onClick={x.onClick} className="flex flex-col items-center gap-1.5 text-xs font-semibold">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.18]"><Icon name={x.icon} /></span>{x.label}
            </button>
          ))}
        </div>
      </section>

      <Card className="flex flex-col gap-2 px-4 py-3.5">
        <span className="text-[13px] text-muted">Balance, last 30 days</span>
        <svg viewBox="0 0 318 64" className="h-16 w-full" preserveAspectRatio="none" aria-hidden>
          <path d={`M${pts} V64 H0z`} fill={a.color} fillOpacity="0.1" />
          <path d={`M${pts}`} fill="none" stroke={a.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </Card>

      {(a.shared || members.length > 0) && (
        <>
          {totalSpent > 0 && (
            <Card className="flex flex-col gap-3 p-4">
              <span className="text-[13px] text-muted">Spent together this month · <Money value={totalSpent} currency={a.currency} className="font-bold text-ink" /></span>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">{members.filter((m) => m.spent).map((m, i) => <span key={m.user} style={{ width: `${(m.spent / totalSpent) * 100}%`, background: COLORS[i % 5] }} />)}</div>
              <div className="num flex flex-wrap justify-between gap-x-3 text-xs text-muted">{members.map((m) => <span key={m.user}>{m.user === user.id ? "You" : m.name.split(" ")[0]} <Money value={m.spent} currency={a.currency} /></span>)}</div>
            </Card>
          )}
          <SectionTitle action={a.isOwner && <button onClick={() => setSheet("invite")} className="flex h-[34px] items-center gap-1.5 rounded-xl bg-card px-3 text-[13px] font-bold"><Icon name="plus" size={14} stroke={2.4} />Invite</button>}>Members</SectionTitle>
          <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
            <div className="flex items-center gap-3 py-3"><Avatar name={data.owner.name} ink /><span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{data.owner.id === user.id ? "You" : data.owner.name}</span><span className="text-xs text-muted">Owner</span></span></div>
            {a.members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.name ?? m.email} color={["#EFE9FF", "#E6F6EE", "#FFF6DB"][i % 3]} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{m.user === user.id ? "You" : m.name ?? m.email}</span>
                  <span className={m.status === "pending" ? "text-xs font-semibold text-warn" : "text-xs text-muted"}>{m.status === "pending" ? "Invite sent · waiting" : m.role === "viewer" ? "Can view" : "Can add and edit"}</span>
                </span>
                {(a.isOwner || m.user === user.id) && (
                  <button
                    onClick={async () => {
                      const leaving = m.user === user.id;
                      const done = await confirm({
                        title: leaving ? `Leave ${a.name}?` : `Remove ${m.name ?? m.email}?`, confirm: leaving ? "Leave" : "Remove", danger: true,
                        action: async () => {
                          await api(`/api/accounts/${id}/members/${m.id}`, { method: "DELETE" });
                          // Once you've left, this wallet's own queries 404.
                          await (leaving ? refreshAfterDelete(qc, ["account", id]) : qc.invalidateQueries());
                        },
                      });
                      if (done && leaving) router.replace("/wallets");
                    }}
                    className="text-[13px] font-bold text-neg"
                  >
                    {m.user === user.id ? "Leave" : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle action={<Link href={`/activity?account=${id}`} className="text-[13px] font-semibold">Filter</Link>}>Transactions</SectionTitle>
      {txs.isLoading ? <Skeleton className="h-32 !rounded-[22px]" /> : list.length ? <TxGroups txs={list} currency={a.currency} tz={user.timezone} /> : <p className="px-1 text-sm text-muted">No transactions in this account yet.</p>}
      {txs.hasNextPage && <Button variant="secondary" size="md" onClick={() => txs.fetchNextPage()} loading={txs.isFetchingNextPage}>Load more</Button>}

      {sheet === "invite" && <InviteSheet accountId={id} name={a.name} onClose={() => setSheet(null)} onSent={() => toast("Invite sent")} />}
      {sheet === "adjust" && <AdjustSheet accountId={id} balance={a.balance} currency={a.currency} onClose={() => setSheet(null)} />}
    </Page>
  );
}

function InviteSheet({ accountId, name, onClose, onSent }: { accountId: string; name: string; onClose: () => void; onSent: () => void }) {
  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const toast = useToast();
  const send = useAction(() => api(`/api/accounts/${accountId}/members`, { body: { email, role } }), {
    onSuccess: () => { onSent(); close(false); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't send", "error"),
  });
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  return (
    <Sheet open={open} onOpenChange={close} title={`Share ${name}`} top={260}>
      <p className="-mt-2 text-sm text-muted">They'll get an email and can see and add transactions in this account.</p>
      <Field label="Their email" type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
      <div className="grid grid-cols-2 gap-2">
        {(["editor", "viewer"] as const).map((r) => (
          <button key={r} onClick={() => setRole(r)} className={`flex flex-col items-start gap-0.5 rounded-2xl border-2 bg-card p-3 text-left ${role === r ? "border-ink" : "border-transparent"}`}>
            <span className="text-sm font-bold">{r === "editor" ? "Can edit" : "Can view"}</span><span className="text-xs text-muted">{r === "editor" ? "Add and change spending" : "See everything, change nothing"}</span>
          </button>
        ))}
      </div>
      <Button loading={send.isPending} disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => send.mutate(undefined)}>Send invite</Button>
    </Sheet>
  );
}

function AdjustSheet({ accountId, balance, currency, onClose }: { accountId: string; balance: number; currency: string; onClose: () => void }) {
  const [open, setOpen] = useState(true);
  const [v, setV] = useState(String(Math.abs(balance) / 100));
  const [negative, setNegative] = useState(balance < 0);
  const { data } = useCategories();
  const toast = useToast();
  const target = Math.round(parseFloat(v || "0") * 100) * (negative ? -1 : 1);
  const diff = target - balance;
  const act = useAction(async () => {
    const type = diff > 0 ? "income" : "expense";
    const cat = data?.categories.find((c) => c.type === type && c.name === (type === "income" ? "Other income" : "Other"));
    await api("/api/transactions", { body: { type, amount: Math.abs(diff), account: accountId, category: cat?.id ?? null, note: "Balance adjustment", tags: ["adjustment"], date: new Date().toISOString() } });
  }, { onSuccess: () => { toast("Balance updated"); close(false); } });
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  return (
    <Sheet open={open} onOpenChange={close} title="Correct balance" top={110}>
      <p className="-mt-2 text-center text-sm text-muted">Enter what's actually in the account. Pocket adds an adjustment for the difference.</p>
      <button onClick={() => setNegative(!negative)} className="num py-1 text-center text-[44px] font-extrabold tracking-[-1.4px]">{negative ? "−" : ""}{symbolFor(currency)} {amountDisplay(v)}</button>
      <span className="-mt-3 text-center text-xs text-muted">Tap the amount to switch between positive and negative</span>
      <Keypad onKey={(k) => setV(applyKey(v, k))} />
      <Button loading={act.isPending} disabled={diff === 0} onClick={() => act.mutate(undefined)}>{diff === 0 ? "No change" : `Save (${diff > 0 ? "+" : "−"}${symbolFor(currency)} ${amountDisplay(String(Math.abs(diff) / 100))})`}</Button>
    </Sheet>
  );
}
