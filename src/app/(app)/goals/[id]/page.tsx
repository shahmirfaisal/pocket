"use client";
import { use, useState } from "react";
import { useApp } from "@/components/app";
import { Button, Card, Keypad, Money, Page, Segmented, Sheet, Skeleton, TopBar, amountDisplay, applyKey, useToast } from "@/components/ui";
import { api, ApiError } from "@/lib/client";
import { useAccounts, useAction, useGoal } from "@/lib/hooks";
import { symbolFor } from "@/lib/money";
import { MONTHS } from "@/lib/dates";

export default function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, open } = useApp();
  const { data } = useGoal(id);
  const [moving, setMoving] = useState<null | "add" | "withdraw">(null);
  const g = data?.goal;
  const pct = g ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0;
  const r = 76, c = 2 * Math.PI * r;

  return (
    <Page nav={false}>
      <TopBar back="/budgets" right={<button onClick={() => open("budget", { goal: id })} className="pressable h-11 rounded-full bg-card px-[18px] text-[15px] font-bold">Edit</button>} />
      {!g ? <Skeleton className="h-[360px] !rounded-[28px]" /> : (
        <>
          <Card className="flex flex-col items-center gap-3.5 !rounded-[28px] p-[22px]">
            <div className="relative h-[180px] w-[180px]">
              <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden className="-rotate-90">
                <circle cx="90" cy="90" r={r} fill="none" stroke="var(--chip)" strokeWidth="16" />
                <circle cx="90" cy="90" r={r} fill="none" stroke="var(--pos)" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5"><span className="text-3xl">{g.emoji}</span><span className="num text-[28px] font-extrabold">{pct}%</span></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl font-extrabold">{g.name}</span>
              <span className="num text-[15px] text-muted"><Money value={g.saved} currency={user.currency} /> of <Money value={g.target} currency={user.currency} /></span>
            </div>
            <div className="grid w-full grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-[3px] rounded-2xl bg-bg p-3"><span className="text-xs text-muted">Target date</span><span className="text-[15px] font-bold">{g.targetDate ? `${MONTHS[new Date(g.targetDate).getMonth()]} ${new Date(g.targetDate).getFullYear()}` : "Not set"}</span></div>
              <div className="flex flex-col gap-[3px] rounded-2xl bg-bg p-3"><span className="text-xs text-muted">{g.left === 0 ? "Left to save" : g.perMonth ? "Save per month" : "Left to save"}</span><span className="text-[15px] font-bold"><Money value={g.perMonth && g.left > 0 ? g.perMonth : g.left} currency={user.currency} /></span></div>
            </div>
            {g.left === 0 ? (
              <span className="text-[13px] font-semibold text-pos">🎉 Goal reached</span>
            ) : g.onTrack !== null && (
              <span className={g.onTrack ? "flex items-center gap-1.5 text-[13px] font-semibold text-pos" : "flex items-center gap-1.5 text-[13px] font-semibold text-warn"}><span className="h-2 w-2 rounded-full bg-current" />{g.onTrack ? "On track" : "Behind — save a bit more each month"}</span>
            )}
          </Card>

          <span className="-mb-1.5 px-1 text-[15px] font-bold">Contributions</span>
          {g.contributions.length === 0 ? <p className="px-1 text-sm text-muted">Nothing saved yet. Tap “Add money” to start.</p> : (
            <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
              {g.contributions.map((x) => (
                <div key={x.id} className="num flex items-center py-3 text-[15px]">
                  <span className="flex flex-1 flex-col gap-0.5"><span className="font-semibold">{x.note || (x.account ? `From ${x.account}` : x.amount > 0 ? "Added" : "Withdrawn")}</span><span className="text-xs text-muted">{new Date(x.date).getDate()} {MONTHS[new Date(x.date).getMonth()]}</span></span>
                  <Money value={x.amount} currency={user.currency} sign className={x.amount > 0 ? "font-bold text-pos" : "font-bold text-neg"} />
                </div>
              ))}
            </Card>
          )}

          <div className="mt-auto grid grid-cols-[1fr_2fr] gap-2.5 pt-4">
            <Button variant="secondary" onClick={() => setMoving("withdraw")} disabled={g.saved <= 0}>Withdraw</Button>
            <Button onClick={() => setMoving("add")}>Add money</Button>
          </div>
        </>
      )}
      {moving && g && <MoveMoney goalId={id} kind={moving} max={g.saved} onClose={() => setMoving(null)} />}
    </Page>
  );
}

function MoveMoney({ goalId, kind, max, onClose }: { goalId: string; kind: "add" | "withdraw"; max: number; onClose: () => void }) {
  const { user } = useApp();
  const toast = useToast();
  const { data } = useAccounts();
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState(kind);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [account, setAccount] = useState(user.defaultAccount ?? "");
  const act = useAction((v: { amount: number }) => api(`/api/goals/${goalId}/contribute`, { body: { amount: v.amount, note, account: account || null } }), {
    onSuccess: () => { toast(mode === "add" ? "Added to goal" : "Withdrawn"); close(false); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't save", "error"),
  });
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  const minor = Math.round(parseFloat(amount || "0") * 100);
  return (
    <Sheet open={open} onOpenChange={close} title={mode === "add" ? "Add money" : "Withdraw"} top={90}>
      <Segmented value={mode} onChange={setMode} options={[{ value: "add", label: "Add" }, { value: "withdraw", label: "Withdraw" }]} />
      <span className="num py-1 text-center text-[44px] font-extrabold tracking-[-1.4px]">{symbolFor(user.currency)} {amountDisplay(amount)}</span>
      <div className="flex gap-2">
        <select value={account} onChange={(e) => setAccount(e.target.value)} className="h-[46px] flex-1 rounded-[14px] bg-card px-3 text-sm font-semibold outline-none">
          <option value="">No account</option>
          {(data?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="h-[46px] flex-1 rounded-[14px] bg-card px-3 text-[15px] outline-none" />
      </div>
      <Keypad onKey={(k) => setAmount(applyKey(amount, k))} />
      <Button loading={act.isPending} disabled={!minor || (mode === "withdraw" && minor > max)} onClick={() => act.mutate({ amount: mode === "add" ? minor : -minor })}>{mode === "add" ? "Add to goal" : "Withdraw"}</Button>
    </Sheet>
  );
}
