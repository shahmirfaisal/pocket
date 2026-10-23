"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useApp, useSheetOpen } from "../app";
import { Button, Sheet, Toggle, useConfirm, useToast } from "../ui";
import { Icon, ACCOUNT_ICON } from "../icons";
import { api, ApiError } from "@/lib/client";
import { useAccount, useAction } from "@/lib/hooks";
import { ACCOUNT_COLORS, ACCOUNT_META } from "@/lib/defaults";
import { CURRENCIES, formatMoney, toMinor } from "@/lib/money";
import type { AccountJSON } from "@/lib/types";

export function AccountSheet({ edit, onClose }: { edit?: string; onClose: () => void }) {
  const [open, setOpen] = useSheetOpen(onClose);
  const q = useAccount(edit ?? "");
  if (edit && !q.data) return <Sheet open={open} onOpenChange={setOpen} title="Edit account"><div className="h-40" /></Sheet>;
  return <AccountForm open={open} setOpen={setOpen} existing={q.data?.account} />;
}

function AccountForm({ open, setOpen, existing }: { open: boolean; setOpen: (o: boolean) => void; existing?: AccountJSON }) {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [type, setType] = useState<string>(existing?.type ?? "bank");
  const [name, setName] = useState(existing?.name ?? "");
  const [balance, setBalance] = useState(existing ? String(existing.startingBalance / 100) : "");
  const [currency, setCurrency] = useState(existing?.currency ?? user.currency);
  const [color, setColor] = useState(existing?.color ?? ACCOUNT_COLORS[1]);
  const [include, setInclude] = useState(existing?.includeInTotal ?? true);
  const [dueDay, setDueDay] = useState(existing?.creditDueDay ? String(existing.creditDueDay) : "");
  const [busy, setBusy] = useState(false);
  const del = useAction(() => api(`/api/accounts/${existing!.id}`, { method: "DELETE" }));

  const startingMinor = balance ? toMinor(balance.startsWith("-") ? balance.slice(1) : balance) * (balance.startsWith("-") ? -1 : 1) : 0;
  const save = async () => {
    setBusy(true);
    const body = { name: name.trim(), type, currency, color, startingBalance: isNaN(startingMinor) ? 0 : startingMinor, includeInTotal: include, creditDueDay: type === "credit" && dueDay ? Number(dueDay) : null };
    try {
      if (existing) await api(`/api/accounts/${existing.id}`, { method: "PATCH", body });
      else {
        const r = await api<{ id: string }>("/api/accounts", { body });
        router.push(`/wallets/${r.id}`);
      }
      toast(existing ? "Saved" : "Account added");
      setOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm({ title: `Delete ${existing.name}?`, body: "Its transactions are deleted too. Archive it instead to keep your history.", confirm: "Delete account", danger: true })) {
      await del.mutateAsync(undefined);
      toast("Account deleted");
      setOpen(false);
      router.replace("/wallets");
    }
  };
  const archive = async () => {
    if (!existing) return;
    await api(`/api/accounts/${existing.id}`, { method: "PATCH", body: { archived: !existing.archived } });
    toast(existing.archived ? "Account restored" : "Account archived");
    setOpen(false);
    router.replace("/wallets");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit account" : "New account"} left={<button onClick={() => setOpen(false)} className="text-[15px] font-semibold text-muted">Cancel</button>} right={null}>
      <div className="flex h-[120px] flex-col justify-between rounded-3xl p-[18px] text-white" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, #ffffff))` }}>
        <span className="flex justify-between text-sm font-semibold"><span>{name || "Account name"}</span><span className="opacity-80">{ACCOUNT_META[type]?.label}</span></span>
        <span className="num text-[30px] font-extrabold tracking-[-0.8px]">{formatMoney(isNaN(startingMinor) ? 0 : startingMinor, currency)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-muted">Type</span>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(ACCOUNT_META).map(([t, m]) => (
            <button key={t} aria-pressed={type === t} onClick={() => { setType(t); if (!name) setName(""); }} className={clsx("flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-card text-xs font-semibold", type === t ? "border-ink" : "border-transparent")}>
              <Icon name={ACCOUNT_ICON[t]} />{m.label}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-[22px] bg-card px-4 py-0.5">
        <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[110px] text-[15px] text-muted">Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder={ACCOUNT_META[type]?.label} maxLength={40} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
        <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[110px] text-[15px] text-muted">{existing ? "Starting balance" : "Balance now"}</span><input value={balance} onChange={(e) => setBalance(e.target.value.replace(/[^\d.-]/g, ""))} inputMode="decimal" placeholder="0" className="num min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
        <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[110px] text-[15px] text-muted">Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="flex-1 appearance-none bg-transparent text-[15px] font-semibold outline-none">
            {Object.keys(CURRENCIES).map((c) => <option key={c}>{c}</option>)}
          </select><Icon name="chevron" size={16} className="text-muted" />
        </label>
        {type === "credit" && (
          <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[110px] text-[15px] text-muted">Bill due day</span><input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="e.g. 5" className="num min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
        )}
        <div className="flex items-center gap-3 py-3">
          <span className="w-[110px] text-[15px] text-muted">Color</span>
          <span className="flex flex-1 flex-wrap gap-2">
            {ACCOUNT_COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} className="h-6 w-6 rounded-full" style={{ background: c, outline: c === color ? `2px solid ${c}` : "none", outlineOffset: 2 }} />)}
          </span>
        </div>
      </section>
      {currency !== user.currency && <p className="-mt-2 px-1 text-xs text-muted">Totals add this account's balance as-is; Pocket doesn't convert between currencies.</p>}

      <div className="flex items-center gap-3 px-1">
        <span className="flex-1 text-sm font-semibold">Include in total balance</span>
        <Toggle label="Include in total balance" checked={include} onChange={setInclude} />
      </div>

      <Button onClick={save} loading={busy} disabled={!name.trim() || isNaN(startingMinor)}>{existing ? "Save" : "Add account"}</Button>
      {existing?.isOwner && (
        <div className="flex gap-2">
          <Button variant="secondary" size="md" className="flex-1" onClick={archive}>{existing.archived ? "Unarchive" : "Archive"}</Button>
          <Button variant="danger" size="md" className="flex-1" onClick={remove}>Delete</Button>
        </div>
      )}
    </Sheet>
  );
}
