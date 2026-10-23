"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app";
import { Avatar, Button, CatIcon, Empty, Keypad, Money, Page, Segmented, SectionTitle, Sheet, Skeleton, TopBar, amountDisplay, applyKey, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError } from "@/lib/client";
import { useAccounts, useAction, usePeople } from "@/lib/hooks";
import { formatMoney, symbolFor } from "@/lib/money";
import type { PersonRow } from "@/lib/types";

export default function SplitsPage() {
  const { user } = useApp();
  const { data } = usePeople();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [settling, setSettling] = useState<PersonRow | null>(null);
  const cur = user.currency;

  const remind = async (p: PersonRow) => {
    const text = `Hey ${p.name}, just a reminder — you owe me ${formatMoney(p.balance, cur)} 🙂`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Reminder copied — paste it in WhatsApp"); }
    } catch {}
  };

  return (
    <Page nav={false}>
      <TopBar back="/wallets" title="Split bills" right={<button onClick={() => setAdding(true)} className="pressable flex h-11 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-bold text-bg"><Icon name="plus" size={16} stroke={2.4} />Split</button>} />
      <div className="num grid grid-cols-2 gap-2.5">
        <section className="flex flex-col gap-1 rounded-[22px] bg-pos-bg p-4"><span className="text-[13px] text-pos">You're owed</span><Money value={data?.owed ?? 0} currency={cur} className="text-2xl font-extrabold text-pos" /></section>
        <section className="flex flex-col gap-1 rounded-[22px] bg-neg-bg p-4"><span className="text-[13px] text-neg">You owe</span><Money value={data?.owe ?? 0} currency={cur} className="text-2xl font-extrabold text-neg" /></section>
      </div>

      {!data ? <Skeleton className="h-40 !rounded-[22px]" /> : data.people.length === 0 ? (
        <Empty icon="split" title="No splits yet" body="When you add an expense, tap ↻ then “Split this bill” to track who owes you. Or record an IOU with the Split button." />
      ) : (
        <>
          <SectionTitle>People</SectionTitle>
          <div className="mt-1 rounded-[22px] bg-card px-4 py-0.5">
            {data.people.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
                <Avatar name={p.name} color={p.color} />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{p.name}</span>
                  <span className={`num text-xs font-semibold ${p.balance > 0 ? "text-pos" : p.balance < 0 ? "text-neg" : "text-muted"}`}>
                    {p.balance > 0 ? <>Owes you <Money value={p.balance} currency={cur} /></> : p.balance < 0 ? <>You owe <Money value={-p.balance} currency={cur} /></> : "All settled"}
                  </span>
                </span>
                {p.balance > 0 && <button onClick={() => remind(p)} className="h-[34px] rounded-xl bg-chip px-3 text-[13px] font-bold">Remind</button>}
                {p.balance !== 0 && <button onClick={() => setSettling(p)} className={`h-[34px] rounded-xl px-3 text-[13px] font-bold ${p.balance < 0 ? "bg-ink text-bg" : "bg-chip"}`}>Settle up</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {data && data.recent.length > 0 && (
        <>
          <SectionTitle>Recent splits</SectionTitle>
          <div className="mt-1 rounded-[22px] bg-card px-4 py-0.5">
            {data.recent.map((d) => {
              const inner = (
                <>
                  <CatIcon emoji={d.amount > 0 ? "🧾" : "🤝"} color={d.amount > 0 ? "#FFF1E8" : "#E9F0FF"} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">{d.note || d.transaction?.note || "Split"}</span>
                    <span className="num truncate text-xs text-muted">{d.transaction ? <><Money value={d.transaction.amount} currency={cur} /> · </> : ""}{d.amount > 0 ? `${d.person.name} owes` : `you owe ${d.person.name}`}{d.settled ? " · settled" : ""}</span>
                  </span>
                  <Money value={d.amount} currency={cur} sign className={`text-sm font-bold ${d.settled ? "text-muted line-through" : d.amount > 0 ? "text-pos" : "text-neg"}`} />
                </>
              );
              return d.transaction ? <Link key={d.id} href={`/transactions/${d.transaction.id}`} className="flex items-center gap-3 border-b border-line py-3 last:border-0">{inner}</Link> : <div key={d.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">{inner}</div>;
            })}
          </div>
        </>
      )}

      {adding && <IouSheet people={data?.people ?? []} onClose={() => setAdding(false)} />}
      {settling && <SettleSheet person={settling} onClose={() => setSettling(null)} />}
    </Page>
  );
}

function IouSheet({ people, onClose }: { people: PersonRow[]; onClose: () => void }) {
  const { user, open: openApp } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(true);
  const [dir, setDir] = useState<"they-owe" | "i-owe">("they-owe");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  const act = useAction(() => api("/api/debts", { body: { name: name.trim(), person: people.find((p) => p.name.toLowerCase() === name.trim().toLowerCase())?.id, amount: Math.round(parseFloat(amount) * 100), direction: dir, note } }), {
    onSuccess: () => { toast("Saved"); close(false); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't save", "error"),
  });
  return (
    <Sheet open={open} onOpenChange={close} title="Record a split" top={60}>
      <button onClick={() => { close(false); setTimeout(() => openApp("add", { type: "expense" }), 320); }} className="flex items-center gap-3 rounded-[18px] bg-card p-3.5 text-left">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="receipt" size={18} /></span>
        <span className="flex flex-1 flex-col"><span className="text-sm font-bold">Split a new expense</span><span className="text-xs text-muted">Add the bill, then choose who to split with</span></span>
        <Icon name="chevron" size={16} className="text-muted" />
      </button>
      <span className="-mb-1 text-[13px] font-semibold text-muted">Or record an IOU</span>
      <Segmented value={dir} onChange={setDir} options={[{ value: "they-owe", label: "They owe me" }, { value: "i-owe", label: "I owe them" }]} />
      <div className="flex gap-2">
        <input list="pocket-people-iou" value={name} onChange={(e) => setName(e.target.value)} placeholder="Who?" className="h-[46px] flex-1 rounded-[14px] bg-card px-3 text-[15px] outline-none" />
        <datalist id="pocket-people-iou">{people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="For what?" className="h-[46px] flex-1 rounded-[14px] bg-card px-3 text-[15px] outline-none" />
      </div>
      <span className="num text-center text-[40px] font-extrabold tracking-[-1.2px]">{symbolFor(user.currency)} {amountDisplay(amount)}</span>
      <Keypad onKey={(k) => setAmount(applyKey(amount, k))} />
      <Button loading={act.isPending} disabled={!name.trim() || !parseFloat(amount)} onClick={() => act.mutate(undefined)}>Save</Button>
    </Sheet>
  );
}

function SettleSheet({ person, onClose }: { person: PersonRow; onClose: () => void }) {
  const { user } = useApp();
  const toast = useToast();
  const { data } = useAccounts();
  const [open, setOpen] = useState(true);
  const [account, setAccount] = useState<string>(user.defaultAccount ?? "");
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  const act = useAction(() => api(`/api/people/${person.id}/settle`, { body: { account: account || null } }), {
    onSuccess: () => { toast(`Settled with ${person.name}`); close(false); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't settle", "error"),
  });
  const theyPay = person.balance > 0;
  return (
    <Sheet open={open} onOpenChange={close} title="Settle up" top={240}>
      <div className="flex flex-col items-center gap-2 py-2 text-center">
        <Avatar name={person.name} color={person.color} size={56} />
        <span className="text-[15px] text-muted">{theyPay ? `${person.name} pays you` : `You pay ${person.name}`}</span>
        <Money value={Math.abs(person.balance)} currency={user.currency} className="text-[36px] font-extrabold" />
      </div>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">{theyPay ? "Money goes into" : "Paid from"}</span>
        <select value={account} onChange={(e) => setAccount(e.target.value)} className="h-[50px] rounded-2xl bg-card px-4 text-[15px] font-semibold outline-none">
          <option value="">Don't record a transaction</option>
          {(data?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <Button loading={act.isPending} onClick={() => act.mutate(undefined)}>Mark as settled</Button>
    </Sheet>
  );
}
