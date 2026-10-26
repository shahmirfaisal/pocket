"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useApp } from "@/components/app";
import { Button, CatIcon, CircleButton, Keypad, Money, Page, Sheet, TopBar, amountDisplay, applyKey, useConfirm, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError, haptic, saveTransaction } from "@/lib/client";
import { useAccounts, useCategories, useTemplates } from "@/lib/hooks";
import { parseQuickAdd } from "@/lib/quickadd";
import { formatMoney, symbolFor } from "@/lib/money";
import type { Template } from "@/lib/types";

export default function QuickAddPage() {
  const { user, open } = useApp();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { data: accData } = useAccounts();
  const { data: catData } = useCategories();
  const { data: tplData } = useTemplates();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);

  const accounts = accData?.accounts ?? [];
  const cats = catData?.categories ?? [];
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text, accounts, cats, user.timezone) : null), [text, accounts, cats, user.timezone]);
  const account = parsed?.account ?? accounts.find((a) => a.id === user.defaultAccount) ?? accounts[0];

  const add = async () => {
    if (!parsed?.amount || !account) return;
    setBusy(true);
    try {
      const r = await saveTransaction({ type: parsed.type, amount: parsed.amount, account: account.id, category: parsed.category?.id ?? null, subcategory: parsed.subcategory, note: parsed.note, tags: parsed.tags, date: parsed.date.toISOString() });
      haptic(12);
      toast(r.queued ? "Saved offline — will sync later" : `${parsed.type === "income" ? "Income" : "Expense"} added`, r.queued ? "info" : "ok");
      setText("");
      await qc.invalidateQueries();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = async (t: Template) => {
    if (editing) {
      await confirm({
        title: `Delete “${t.name}”?`, confirm: "Delete", danger: true,
        action: async () => {
          await api(`/api/templates/${t.id}`, { method: "DELETE" });
          await qc.invalidateQueries({ queryKey: ["templates"] });
        },
      });
      return;
    }
    const acc = t.account?.id ?? account?.id;
    if (!acc) return;
    try {
      await saveTransaction({ type: t.type, amount: t.amount, account: acc, category: t.category?.id ?? null, note: t.name, tags: [], date: new Date().toISOString() });
      haptic(12);
      toast(`${t.name} · ${formatMoney(t.amount, user.currency)} added`);
      qc.invalidateQueries();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
    }
  };

  const edit = () => {
    if (!parsed) return;
    open("add", { type: parsed.type, prefill: { amount: parsed.amount ?? undefined, category: parsed.category?.id, subcategory: parsed.subcategory, note: parsed.note, date: parsed.date.toISOString(), account: account?.id } });
  };

  return (
    <Page nav={false}>
      <TopBar title="Quick add" large right={<CircleButton icon="close" label="Close" variant="chip" size={36} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} />} />
      <section className={clsx("flex flex-col gap-3 rounded-[22px] border-2 bg-card px-4 py-3.5 transition-colors", text ? "border-ink" : "border-transparent")}>
        <textarea
          autoFocus
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value.replace(/\n/g, ""))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="lunch 850 jazzcash"
          enterKeyHint="done"
          className="resize-none bg-transparent text-lg font-semibold outline-none placeholder:font-medium placeholder:text-faint"
        />
        {parsed && (
          <button onClick={edit} className="flex flex-wrap gap-1.5 text-left" aria-label="Change details">
            {parsed.category && <span className="tint flex h-[30px] items-center gap-1 rounded-[10px] px-2.5 text-[13px] font-semibold" style={{ ["--c" as string]: parsed.category.color }}>{parsed.category.emoji} {parsed.category.name}{parsed.subcategory ? ` · ${parsed.subcategory}` : ""}</span>}
            <span className={clsx("num flex h-[30px] items-center rounded-[10px] px-2.5 text-[13px] font-bold", parsed.amount ? "bg-chip" : "bg-neg-bg text-neg")}>{parsed.amount ? formatMoney(parsed.amount, user.currency) : "Add an amount"}</span>
            {account && <span className="flex h-[30px] items-center rounded-[10px] bg-chip px-2.5 text-[13px] font-semibold">{account.name}</span>}
            <span className="flex h-[30px] items-center rounded-[10px] bg-chip px-2.5 text-[13px] font-semibold text-muted">{parsed.dateLabel}</span>
            {parsed.type === "income" && <span className="flex h-[30px] items-center rounded-[10px] bg-pos-bg px-2.5 text-[13px] font-semibold text-pos">Income</span>}
            {parsed.tags.map((t) => <span key={t} className="flex h-[30px] items-center rounded-[10px] bg-chip px-2.5 text-[13px] font-semibold">#{t}</span>)}
          </button>
        )}
        <Button variant="accent" size="md" loading={busy} disabled={!parsed?.amount || !account} onClick={add}>
          {parsed?.amount ? `Add ${parsed.type} · ${formatMoney(parsed.amount, user.currency)}` : "Add expense"}
        </Button>
      </section>
      <p className="-mt-1.5 px-1 text-xs leading-normal text-muted">Type what you spent, how much and where — like “petrol 3000 cash yesterday” or “salary +185000 hbl”. Tap the chips to change anything.</p>

      <div className="flex items-center justify-between px-1">
        <span className="text-[15px] font-bold">Templates</span>
        {(tplData?.templates.length ?? 0) > 0 && <button onClick={() => setEditing(!editing)} className="text-sm font-bold">{editing ? "Done" : "Edit"}</button>}
      </div>
      <div className="-mt-1.5 grid grid-cols-2 gap-2.5">
        {(tplData?.templates ?? []).map((t) => (
          <button key={t.id} onClick={() => applyTemplate(t)} className={clsx("pressable relative flex flex-col gap-2 rounded-[18px] bg-card p-3 text-left", editing && "animate-pulse")}>
            {editing && <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-neg text-white"><Icon name="close" size={12} stroke={3} /></span>}
            <CatIcon emoji={t.emoji} color={t.category?.color} size={36} radius={12} />
            <span className="text-sm font-bold">{t.name}</span>
            <span className="num text-[13px] text-muted"><Money value={t.amount} currency={user.currency} /> · {t.account?.name ?? account?.name ?? ""}</span>
          </button>
        ))}
      </div>
      <button onClick={() => setCreating(true)} className="pressable flex h-12 items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-faint text-sm font-semibold">
        <Icon name="plus" size={16} stroke={2.2} /> Save a new template
      </button>

      <section className="flex items-center gap-3 rounded-[22px] border bg-hero px-4 py-3.5 text-hero-ink" style={{ borderColor: "var(--hero-border)" }}>
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[13px] bg-white/10"><Icon name="phone" /></span>
        <span className="flex flex-col gap-0.5"><span className="text-sm font-bold">One tap from your Home Screen</span><span className="text-xs text-hero-muted">Open this page in Safari and choose Share → Add to Home Screen to get a Quick add icon</span></span>
      </section>

      {creating && <TemplateSheet onClose={() => setCreating(false)} />}
    </Page>
  );
}

function TemplateSheet({ onClose }: { onClose: () => void }) {
  const { user } = useApp();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: catData } = useCategories();
  const { data: accData } = useAccounts();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [account, setAccount] = useState<string>(user.defaultAccount ?? "");
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };
  const cats = (catData?.categories ?? []).filter((c) => c.type === "expense");
  const cat = cats.find((c) => c.id === category);
  const save = async () => {
    try {
      await api("/api/templates", { body: { name: name.trim(), emoji: cat?.emoji ?? "⚡", type: "expense", amount: Math.round(parseFloat(amount) * 100), category, account: account || null } });
      await qc.invalidateQueries({ queryKey: ["templates"] });
      toast("Template saved");
      close(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
    }
  };
  return (
    <Sheet open={open} onOpenChange={close} title="New template" top={50}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning chai" maxLength={30} className="h-[50px] rounded-2xl bg-card px-4 text-[17px] font-semibold outline-none" />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {cats.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)} className="flex w-[60px] flex-none flex-col items-center gap-1 text-[11px] font-semibold">
            <span className={clsx("rounded-2xl p-[2px]", category === c.id ? "ring-2 ring-ink" : "ring-2 ring-transparent")}><CatIcon emoji={c.emoji} color={c.color} size={46} radius={14} /></span>
            <span className="w-full truncate text-center">{c.name}</span>
          </button>
        ))}
      </div>
      <select value={account} onChange={(e) => setAccount(e.target.value)} className="h-12 rounded-2xl bg-card px-4 text-[15px] font-semibold outline-none">
        <option value="">Default account</option>{(accData?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <span className="num text-center text-[40px] font-extrabold tracking-[-1.2px]">{symbolFor(user.currency)} {amountDisplay(amount)}</span>
      <Keypad onKey={(k) => setAmount(applyKey(amount, k))} />
      <Button disabled={!name.trim() || !parseFloat(amount)} onClick={save}>Save template</Button>
    </Sheet>
  );
}
