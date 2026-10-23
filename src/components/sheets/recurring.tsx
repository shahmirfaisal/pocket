"use client";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp, useSheetOpen } from "../app";
import { Button, CatIcon, Keypad, Segmented, Sheet, Toggle, amountDisplay, applyKey, useConfirm, useToast } from "../ui";
import { Icon } from "../icons";
import { api, ApiError } from "@/lib/client";
import { useAccounts, useCategories } from "@/lib/hooks";
import { symbolFor } from "@/lib/money";
import { CategoryPicker } from "./add";

type Item = { id: string; type: "expense" | "income"; name: string; amount: number; account: string; category: string | null; subcategory: string | null; frequency: "daily" | "weekly" | "monthly" | "yearly"; interval: number; nextDate: string; mode: "auto" | "ask"; subscription: boolean; paused: boolean };

export function RecurringSheet({ edit, onClose }: { edit?: string; onClose: () => void }) {
  const [open, setOpen] = useSheetOpen(onClose);
  const q = useQuery({ queryKey: ["recurring-item", edit], enabled: !!edit, queryFn: () => api<{ item: Item }>(`/api/recurring/${edit}`) });
  if (edit && !q.data) return <Sheet open={open} onOpenChange={setOpen} title="Edit"><div className="h-40" /></Sheet>;
  return <RecurringForm open={open} setOpen={setOpen} existing={q.data?.item} />;
}

function RecurringForm({ open, setOpen, existing }: { open: boolean; setOpen: (o: boolean) => void; existing?: Item }) {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { data: accData } = useAccounts();
  const { data: catData } = useCategories();
  const [type, setType] = useState<"expense" | "income">(existing?.type ?? "expense");
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount / 100) : "");
  const [account, setAccount] = useState(existing?.account ?? user.defaultAccount ?? "");
  const [category, setCategory] = useState<string | null>(existing?.category ?? null);
  const [sub, setSub] = useState<string | null>(existing?.subcategory ?? null);
  const [frequency, setFrequency] = useState(existing?.frequency ?? "monthly");
  const [next, setNext] = useState((existing?.nextDate ? new Date(existing.nextDate) : new Date()).toISOString().slice(0, 10));
  const [mode, setMode] = useState<"auto" | "ask">(existing?.mode ?? "auto");
  const [subscription, setSubscription] = useState(existing?.subscription ?? false);
  const [paused, setPaused] = useState(existing?.paused ?? false);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const accounts = accData?.accounts ?? [];
  useEffect(() => { if (!account && accounts[0]) setAccount(accounts[0].id); }, [account, accounts]);
  const cats = (catData?.categories ?? []).filter((c) => c.type === type);
  const cat = cats.find((c) => c.id === category);
  const minor = Math.round(parseFloat(amount || "0") * 100);

  const save = async () => {
    setBusy(true);
    // Run at 9am local on the chosen day
    const [y, m, d] = next.split("-").map(Number);
    const when = new Date(y, m - 1, d, 9, 0);
    const body = { type, name: name.trim(), amount: minor, account, category, subcategory: sub, frequency, interval: 1, nextDate: when.toISOString(), mode, subscription, paused, emoji: cat?.emoji ?? "🔁" };
    try {
      if (existing) await api(`/api/recurring/${existing.id}`, { method: "PATCH", body });
      else await api("/api/recurring", { body });
      await qc.invalidateQueries();
      toast("Saved");
      setOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Stop "${existing!.name}"?`, body: "Past transactions stay. It just won't repeat any more.", confirm: "Delete", danger: true }))) return;
    await api(`/api/recurring/${existing!.id}`, { method: "DELETE" });
    await qc.invalidateQueries();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit recurring" : "New recurring"} left={<button onClick={() => setOpen(false)} className="text-[15px] font-semibold text-muted">Cancel</button>} right={null}>
      <Segmented value={type} onChange={(t) => { setType(t); setCategory(null); }} options={[{ value: "expense", label: "Bill / subscription" }, { value: "income", label: "Income" }]} />
      <div className="flex flex-col items-center py-1">
        <span className="num text-[44px] font-extrabold tracking-[-1.4px]">{symbolFor(user.currency)} {amountDisplay(amount)}</span>
      </div>
      <section className="rounded-[22px] bg-card px-4 py-0.5">
        <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[96px] text-[15px] text-muted">Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "income" ? "Salary" : "Netflix"} maxLength={40} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
        <button onClick={() => setPicking(true)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
          <span className="w-[96px] text-[15px] text-muted">Category</span>
          <span className="flex flex-1 items-center gap-2 text-[15px] font-semibold">{cat ? <><CatIcon emoji={cat.emoji} color={cat.color} size={26} />{cat.name}{sub ? ` · ${sub}` : ""}</> : <span className="text-faint">Choose</span>}</span>
          <Icon name="chevron" size={16} className="text-muted" />
        </button>
        <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[96px] text-[15px] text-muted">Account</span>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className="flex-1 appearance-none bg-transparent text-[15px] font-semibold outline-none">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </label>
        <div className="flex items-center gap-3 border-b border-line py-3">
          <span className="w-[96px] text-[15px] text-muted">Every</span>
          <div className="flex-1"><Segmented size="sm" value={frequency} onChange={setFrequency} options={[{ value: "weekly", label: "Week" }, { value: "monthly", label: "Month" }, { value: "yearly", label: "Year" }]} /></div>
        </div>
        <label className="flex items-center gap-3 py-3"><span className="w-[96px] text-[15px] text-muted">Next date</span><input type="date" value={next} onChange={(e) => setNext(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
      </section>
      <section className="rounded-[22px] bg-card px-4 py-0.5">
        <div className="flex items-center gap-3 border-b border-line py-3">
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Add automatically</span><span className="text-xs text-muted">{mode === "auto" ? "Logged on the day without asking" : "You'll get a reminder to confirm it"}</span></span>
          <Toggle label="Add automatically" checked={mode === "auto"} onChange={(v) => setMode(v ? "auto" : "ask")} />
        </div>
        {type === "expense" && (
          <div className="flex items-center gap-3 border-b border-line py-3">
            <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Subscription</span><span className="text-xs text-muted">Shows under Subscriptions</span></span>
            <Toggle label="Subscription" checked={subscription} onChange={setSubscription} />
          </div>
        )}
        <div className="flex items-center gap-3 py-3">
          <span className="flex-1 text-[15px] font-semibold">Paused</span>
          <Toggle label="Paused" checked={paused} onChange={setPaused} />
        </div>
      </section>
      <Keypad onKey={(k) => setAmount(applyKey(amount, k))} />
      <Button onClick={save} loading={busy} disabled={!minor || !name.trim() || !account}>Save</Button>
      {existing && <Button variant="danger" size="md" onClick={remove}>Delete</Button>}
      {picking && <CategoryPicker cats={cats} value={category} sub={sub} onPick={(c, s) => { setCategory(c); setSub(s); setPicking(false); }} onClose={() => setPicking(false)} />}
    </Sheet>
  );
}
