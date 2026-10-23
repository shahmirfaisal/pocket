"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useApp, useSheetOpen, type AddProps } from "../app";
import { Avatar, Button, CatIcon, Keypad, Segmented, Sheet, Toggle, amountDisplay, applyKey, useToast } from "../ui";
import { Icon, ACCOUNT_ICON } from "../icons";
import { api, ApiError, haptic, saveTransaction } from "@/lib/client";
import { useAccounts, useCategories, usePeople, useTransaction } from "@/lib/hooks";
import { symbolFor, formatMoney } from "@/lib/money";
import type { CategoryJSON } from "@/lib/types";
import { dayLabel, timeLabel } from "../tx";

type Kind = "expense" | "income" | "transfer";

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function AddSheet({ onClose, ...props }: AddProps & { onClose: () => void }) {
  const [open, setOpen] = useSheetOpen(onClose);
  const editing = useTransaction(props.edit ?? "");
  if (props.edit && !editing.data) {
    return (
      <Sheet open={open} onOpenChange={setOpen} title="Edit">
        <div className="flex h-40 items-center justify-center text-muted">{editing.error ? (editing.error as Error).message : "Loading…"}</div>
      </Sheet>
    );
  }
  return <AddForm {...props} open={open} setOpen={setOpen} existing={editing.data?.transaction} />;
}

function AddForm({ open, setOpen, existing, ...props }: AddProps & { open: boolean; setOpen: (o: boolean) => void; existing?: import("@/lib/types").TxJSON }) {
  const { user } = useApp();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: accData } = useAccounts();
  const { data: catData } = useCategories();
  const accounts = useMemo(() => (accData?.accounts ?? []).filter((a) => a.isOwner || a.members.some((m) => m.user === user.id && m.role !== "viewer")), [accData, user.id]);
  const cats = catData?.categories ?? [];

  const [kind, setKind] = useState<Kind>(existing?.type ?? props.type ?? "expense");
  const [amount, setAmount] = useState(existing ? String(existing.amount / 100) : props.prefill?.amount ? String(props.prefill.amount / 100) : "");
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category?.id ?? props.prefill?.category ?? null);
  const [sub, setSub] = useState<string | null>(existing?.subcategory ?? props.prefill?.subcategory ?? null);
  const [accountId, setAccountId] = useState<string | null>(existing?.account.id ?? props.prefill?.account ?? props.account ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccount?.id ?? null);
  const [date, setDate] = useState<Date>(existing ? new Date(existing.date) : props.prefill?.date ? new Date(props.prefill.date) : new Date());
  const [note, setNote] = useState(existing?.note ?? props.prefill?.note ?? "");
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [receipt] = useState<string | null>(existing?.receipt ?? props.prefill?.receipt ?? null);
  const [repeat, setRepeat] = useState<"" | "weekly" | "monthly" | "yearly">("");
  const [split, setSplit] = useState<{ name: string; person?: string; amount: string }[] | null>(null);
  const [picker, setPicker] = useState<null | "category" | "account" | "toAccount" | "more">(null);
  const [busy, setBusy] = useState(false);

  // Sensible defaults once data arrives
  useEffect(() => {
    if (!accountId && accounts.length) setAccountId(user.defaultAccount && accounts.some((a) => a.id === user.defaultAccount) ? user.defaultAccount : accounts[0].id);
  }, [accounts, accountId, user.defaultAccount]);
  useEffect(() => {
    if (kind === "transfer" && !toAccountId && accounts.length > 1) setToAccountId(accounts.find((a) => a.id !== accountId)?.id ?? null);
  }, [kind, toAccountId, accounts, accountId]);

  const typeCats = cats.filter((c) => c.type === (kind === "income" ? "income" : "expense"));
  useEffect(() => {
    if (kind === "transfer") return;
    const c = cats.find((x) => x.id === categoryId);
    if (!c || c.type !== kind) { setCategoryId(typeCats[0]?.id ?? null); setSub(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, cats.length]);

  const category = cats.find((c) => c.id === categoryId) ?? null;
  const account = accounts.find((a) => a.id === accountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const minor = Math.round(parseFloat(amount || "0") * 100);
  const splitTotal = (split ?? []).reduce((s, p) => s + Math.round(parseFloat(p.amount || "0") * 100), 0);
  const quick = typeCats.slice(0, 4);
  if (category && category.type === kind && !quick.some((c) => c.id === category.id)) quick[3] = category;

  const canSave = minor > 0 && accountId && (kind !== "transfer" || (toAccountId && toAccountId !== accountId)) && (!split || (split.every((p) => p.name.trim() && parseFloat(p.amount) > 0) && splitTotal <= minor));

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    const body = {
      type: kind, amount: minor, account: accountId, toAccount: kind === "transfer" ? toAccountId : null,
      category: kind === "transfer" ? null : categoryId, subcategory: kind === "transfer" ? null : sub,
      note: note.trim(), tags, date: date.toISOString(), receipt,
      repeat: !existing && repeat && kind !== "transfer" ? repeat : null,
      split: !existing && split && kind === "expense" ? { people: split.map((p) => ({ person: p.person, name: p.person ? undefined : p.name.trim(), amount: Math.round(parseFloat(p.amount) * 100) })) } : null,
    };
    try {
      if (existing) {
        await api(`/api/transactions/${existing.id}`, { method: "PATCH", body });
        toast("Saved");
      } else {
        const r = await saveTransaction(body);
        toast(r.queued ? "Saved offline — will sync when you're back online" : kind === "transfer" ? "Money moved" : kind === "income" ? "Income added" : "Expense added", r.queued ? "info" : "ok");
      }
      haptic(12);
      await qc.invalidateQueries();
      setOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
      setBusy(false);
    }
  };

  const sym = symbolFor(account?.currency ?? user.currency);
  const title = existing ? "Edit" : "";

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title={title}
      top={44}
      left={<button aria-label="Close" onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-chip"><Icon name="close" size={16} stroke={2.4} /></button>}
      right={
        <div className="w-[230px]">
          <Segmented size="sm" value={kind} onChange={(k) => !existing && setKind(k)} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }, { value: "transfer", label: "Transfer" }]} />
        </div>
      }
    >
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className="num flex items-baseline gap-1.5 font-extrabold tracking-[-1.4px]">
          <span className="text-[26px] text-muted">{sym}</span>
          <span className={clsx("text-[52px] leading-none", !amount && "text-faint")}>{amountDisplay(amount)}</span>
        </div>
        {receipt && <span className="flex items-center gap-1 text-xs font-semibold text-pos"><Icon name="receipt" size={14} /> Receipt attached</span>}
      </div>

      {kind !== "transfer" ? (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {quick.map((c) => (
            <button key={c.id} onClick={() => { haptic(4); setCategoryId(c.id); setSub(null); }} className="flex w-[62px] flex-none flex-col items-center gap-1.5">
              <span className={clsx("rounded-[18px] p-[2px]", c.id === categoryId ? "ring-2 ring-ink" : "ring-2 ring-transparent")}><CatIcon emoji={c.emoji} color={c.color} size={50} radius={16} /></span>
              <span className={clsx("w-full truncate text-center text-xs", c.id === categoryId ? "font-bold" : "font-medium text-ink-2")}>{c.name}</span>
            </button>
          ))}
          <button onClick={() => setPicker("category")} className="flex w-[62px] flex-none flex-col items-center gap-1.5">
            <span className="flex h-[54px] w-[54px] items-center justify-center rounded-[18px] bg-chip"><Icon name="dots" size={22} /></span>
            <span className="text-xs font-medium text-ink-2">More</span>
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col rounded-[22px] bg-card px-4 py-1">
          <AccountButton label="From" a={account} onClick={() => setPicker("account")} />
          <div className="h-px bg-line" />
          <AccountButton label="To" a={toAccount} onClick={() => setPicker("toAccount")} />
          <button aria-label="Swap accounts" onClick={() => { setAccountId(toAccountId); setToAccountId(accountId); haptic(6); }} className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-card bg-ink text-bg">
            <Icon name="swap" size={16} stroke={2.2} />
          </button>
        </div>
      )}

      {kind !== "transfer" && category && category.subcategories.length > 0 && (
        <div className="no-scrollbar -mx-5 -mt-1 flex gap-2 overflow-x-auto px-5">
          {category.subcategories.map((s) => (
            <button key={s} onClick={() => setSub(sub === s ? null : s)} className={clsx("h-8 flex-none rounded-full px-3 text-[13px]", sub === s ? "bg-ink font-bold text-bg" : "bg-card font-semibold")}>{s}</button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {kind !== "transfer" && (
          <button onClick={() => setPicker("account")} className="flex h-[46px] flex-1 items-center gap-2 rounded-[14px] bg-card px-3 text-sm font-semibold">
            <Icon name={ACCOUNT_ICON[account?.type ?? "cash"] ?? "wallet"} size={18} /><span className="flex-1 truncate text-left">{account?.name ?? "Account"}</span><Icon name="down" size={16} stroke={2} />
          </button>
        )}
        <label className="relative flex h-[46px] flex-1 items-center gap-2 rounded-[14px] bg-card px-3 text-sm font-semibold">
          <Icon name="calendar" size={18} />
          <span className="truncate">{dayLabel(date.toISOString(), user.timezone)}, {timeLabel(date.toISOString(), user.timezone)}</span>
          <input type="datetime-local" aria-label="Date and time" value={toLocalInput(date)} onChange={(e) => e.target.value && setDate(new Date(e.target.value))} className="absolute inset-0 opacity-0" />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <label className="flex h-[46px] flex-1 items-center gap-2 rounded-[14px] bg-card px-3">
          <Icon name="note" size={18} className="text-muted" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "transfer" ? "Note (optional)" : "What was it for?"} maxLength={200} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" enterKeyHint="done" />
        </label>
        {kind !== "transfer" && !existing && (
          <>
            <button aria-label="Scan receipt" onClick={() => { setOpen(false); router.push("/scan"); }} className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-card"><Icon name="camera" /></button>
            <button aria-label="Repeat" aria-pressed={!!repeat} onClick={() => setPicker("more")} className={clsx("flex h-[46px] w-[46px] items-center justify-center rounded-[14px]", repeat || split ? "bg-ink text-bg" : "bg-card")}><Icon name="repeat" /></button>
          </>
        )}
      </div>

      {(repeat || split || tags.length > 0) && (
        <div className="-mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
          {repeat && <span className="rounded-full bg-card px-2.5 py-1">Repeats {repeat}</span>}
          {split && <span className="rounded-full bg-card px-2.5 py-1">Split with {split.map((p) => p.name || "…").join(", ")}</span>}
          {tags.map((t) => <span key={t} className="rounded-full bg-card px-2.5 py-1">#{t}</span>)}
        </div>
      )}

      <Keypad onKey={(k) => setAmount(applyKey(amount, k))} />
      <Button onClick={save} loading={busy} disabled={!canSave}>
        {existing ? "Save changes" : kind === "transfer" ? `Move ${minor ? formatMoney(minor, account?.currency ?? user.currency) : "money"}` : kind === "income" ? "Save income" : "Save expense"}
      </Button>

      {picker === "category" && (
        <CategoryPicker
          cats={typeCats}
          value={categoryId}
          sub={sub}
          onPick={(c, s) => { setCategoryId(c); setSub(s); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      )}
      {(picker === "account" || picker === "toAccount") && (
        <Sheet nested open onOpenChange={(o) => !o && setPicker(null)} title={picker === "toAccount" ? "Move to" : kind === "transfer" ? "Move from" : "Account"} top={220}>
          <div className="rounded-[22px] bg-card px-4 py-1">
            {accounts.map((a) => (
              <button key={a.id} onClick={() => { picker === "toAccount" ? setToAccountId(a.id) : setAccountId(a.id); setPicker(null); }} className="flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-[13px]" style={{ color: a.color, background: `color-mix(in srgb, ${a.color} 14%, var(--card))` }}><Icon name={ACCOUNT_ICON[a.type] ?? "wallet"} /></span>
                <span className="flex-1 text-[15px] font-semibold">{a.name}</span>
                <span className="num text-[13px] text-muted">{formatMoney(a.balance, a.currency)}</span>
                {(picker === "toAccount" ? toAccountId : accountId) === a.id && <Icon name="check" stroke={2.4} />}
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {picker === "more" && (
        <MoreOptions
          repeat={repeat} setRepeat={setRepeat} split={split} setSplit={setSplit} tags={tags} setTags={setTags} total={minor} canSplit={kind === "expense"}
          onClose={() => setPicker(null)}
        />
      )}
    </Sheet>
  );
}

function AccountButton({ label, a, onClick }: { label: string; a?: { name: string; type: string; color: string; balance: number; currency: string }; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left">
      <span className="flex h-10 w-10 items-center justify-center rounded-[13px]" style={{ color: a?.color ?? "#5F6672", background: `color-mix(in srgb, ${a?.color ?? "#5F6672"} 14%, var(--card))` }}><Icon name={ACCOUNT_ICON[a?.type ?? "other"] ?? "wallet"} /></span>
      <span className="flex flex-1 flex-col gap-0.5"><span className="text-xs text-muted">{label}</span><span className="text-[15px] font-bold">{a?.name ?? "Choose account"}</span></span>
      {a && <span className="num text-[13px] text-muted">{formatMoney(a.balance, a.currency)}</span>}
    </button>
  );
}

export function CategoryPicker({ cats, value, sub, onPick, onClose, nested = true }: { cats: CategoryJSON[]; value: string | null; sub: string | null; onPick: (id: string, sub: string | null) => void; onClose: () => void; nested?: boolean }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(value);
  const filtered = q ? cats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.subcategories.some((s) => s.toLowerCase().includes(q.toLowerCase())) || c.keywords.some((k) => k.includes(q.toLowerCase()))) : cats;
  const selected = cats.find((c) => c.id === sel);
  const router = useRouter();
  return (
    <Sheet nested={nested} open onOpenChange={(o) => !o && onClose()} title="Category" top={100}>
      <label className="flex h-11 items-center gap-2 rounded-[14px] bg-seg px-3 text-muted">
        <Icon name="search" size={18} stroke={2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories" className="flex-1 bg-transparent text-[15px] text-ink outline-none" />
      </label>
      <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => { if (c.subcategories.length) setSel(c.id); else onPick(c.id, null); }} className="flex flex-col items-center gap-1.5 text-xs font-semibold">
            <span className={clsx("rounded-[20px] p-[2px]", sel === c.id ? "ring-2 ring-ink" : "ring-2 ring-transparent")}><CatIcon emoji={c.emoji} color={c.color} size={56} radius={18} /></span>
            <span className="w-full truncate text-center">{c.name}</span>
          </button>
        ))}
        <button onClick={() => { onClose(); router.push("/categories?new=1"); }} className="flex flex-col items-center gap-1.5 text-xs font-semibold">
          <span className="m-[2px] flex h-14 w-14 items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-faint text-[22px] text-muted">+</span>New
        </button>
      </div>
      {selected && selected.subcategories.length > 0 && (
        <section className="flex flex-col gap-2.5 rounded-[18px] bg-card p-3.5">
          <span className="text-[13px] font-semibold text-muted">{selected.name} › subcategory</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => onPick(selected.id, null)} className={clsx("h-[34px] rounded-full px-3 text-[13px]", sel === value && !sub ? "bg-ink font-bold text-bg" : "bg-chip font-semibold")}>Just {selected.name}</button>
            {selected.subcategories.map((s) => (
              <button key={s} onClick={() => onPick(selected.id, s)} className={clsx("h-[34px] rounded-full px-3 text-[13px]", sel === value && sub === s ? "bg-ink font-bold text-bg" : "bg-chip font-semibold")}>{s}</button>
            ))}
          </div>
        </section>
      )}
    </Sheet>
  );
}

function MoreOptions({
  repeat, setRepeat, split, setSplit, tags, setTags, total, canSplit, onClose,
}: {
  repeat: string; setRepeat: (r: "" | "weekly" | "monthly" | "yearly") => void;
  split: { name: string; person?: string; amount: string }[] | null; setSplit: (s: { name: string; person?: string; amount: string }[] | null) => void;
  tags: string[]; setTags: (t: string[]) => void; total: number; canSplit: boolean; onClose: () => void;
}) {
  const { data } = usePeople();
  const [tag, setTag] = useState("");
  const people = split ?? [];
  const evenly = () => {
    const n = people.length + 1;
    const each = Math.floor(total / n) / 100;
    setSplit(people.map((p) => ({ ...p, amount: String(each) })));
  };
  return (
    <Sheet nested open onOpenChange={(o) => !o && onClose()} title="More options" top={120} right={<button onClick={onClose} className="text-[15px] font-bold">Done</button>}>
      <section className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
        <span className="text-[15px] font-semibold">Repeat</span>
        <Segmented size="sm" value={(repeat || "never") as "never"} onChange={(v) => setRepeat(v === "never" ? "" : (v as "weekly"))} options={[{ value: "never", label: "Never" }, { value: "weekly" as "never", label: "Weekly" }, { value: "monthly" as "never", label: "Monthly" }, { value: "yearly" as "never", label: "Yearly" }]} />
        {repeat && <span className="text-xs text-muted">Pocket will add this automatically every {repeat.replace("ly", "")}. Manage it in Recurring.</span>}
      </section>

      {canSplit && (
        <section className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex flex-col"><span className="text-[15px] font-semibold">Split this bill</span><span className="text-xs text-muted">Track who owes you their share</span></span>
            <Toggle label="Split this bill" checked={!!split} onChange={(v) => setSplit(v ? [{ name: "", amount: "" }] : null)} />
          </div>
          {split && (
            <>
              {people.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Avatar name={p.name || "?"} size={32} />
                  <input list="pocket-people" value={p.name} onChange={(e) => { const person = data?.people.find((x) => x.name.toLowerCase() === e.target.value.toLowerCase()); setSplit(people.map((x, j) => (j === i ? { ...x, name: e.target.value, person: person?.id } : x))); }} placeholder="Name" className="h-10 min-w-0 flex-1 rounded-xl bg-chip px-3 text-[15px] outline-none" />
                  <input value={p.amount} inputMode="decimal" onChange={(e) => setSplit(people.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^\d.]/g, "") } : x)))} placeholder="Their share" className="num h-10 w-[110px] rounded-xl bg-chip px-3 text-right text-[15px] outline-none" />
                  <button aria-label="Remove" onClick={() => setSplit(people.length > 1 ? people.filter((_, j) => j !== i) : null)} className="text-muted"><Icon name="close" size={16} /></button>
                </div>
              ))}
              <datalist id="pocket-people">{data?.people.map((p) => <option key={p.id} value={p.name} />)}</datalist>
              <div className="flex gap-2">
                <button onClick={() => setSplit([...people, { name: "", amount: "" }])} className="h-9 flex-1 rounded-xl bg-chip text-[13px] font-bold">+ Add person</button>
                <button onClick={evenly} disabled={!total} className="h-9 flex-1 rounded-xl bg-chip text-[13px] font-bold disabled:opacity-40">Split evenly</button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
        <span className="text-[15px] font-semibold">Tags</span>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => <button key={t} onClick={() => setTags(tags.filter((x) => x !== t))} className="h-8 rounded-full bg-ink px-3 text-[13px] font-bold text-bg">#{t} ×</button>)}
          <form onSubmit={(e) => { e.preventDefault(); const v = tag.trim().replace(/^#/, "").toLowerCase(); if (v && !tags.includes(v)) setTags([...tags, v]); setTag(""); }} className="flex">
            <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="#work" className="h-8 w-28 rounded-full bg-chip px-3 text-[13px] outline-none" enterKeyHint="done" />
          </form>
        </div>
      </section>
    </Sheet>
  );
}
