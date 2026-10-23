"use client";
import { useState } from "react";
import clsx from "clsx";
import { Button, Card, Keypad, Sheet, Segmented, applyKey, amountDisplay } from "@/components/ui";
import { Icon, ACCOUNT_ICON } from "@/components/icons";
import { api, ApiError } from "@/lib/client";
import { CURRENCIES, formatMoney, toMinor } from "@/lib/money";
import { ACCOUNT_COLORS, ACCOUNT_META } from "@/lib/defaults";

type Acc = { name: string; type: string; startingBalance: number; color: string };

const PRESETS: Acc[] = [
  { name: "Cash", type: "cash", startingBalance: 0, color: "#13824F" },
  { name: "Bank", type: "bank", startingBalance: 0, color: "#2F5BEA" },
];

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState("PKR");
  const [accounts, setAccounts] = useState<Acc[]>(PRESETS);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = accounts.reduce((s, a) => s + a.startingBalance, 0);

  const finish = async () => {
    setBusy(true); setError(null);
    try {
      await api("/api/setup", {
        body: {
          currency,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          accounts: accounts.map((a) => ({ ...a, currency, includeInTotal: true })),
        },
      });
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-[480px] flex-col gap-5 px-5 pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 24px)" }}>
      <div className="grid grid-cols-3 gap-1.5" aria-label={`Step ${step} of 3`}>
        {[1, 2, 3].map((i) => <span key={i} className={clsx("h-1 rounded-full transition-colors", i <= step ? "bg-ink" : "bg-seg")} />)}
      </div>

      {step === 1 && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-muted">Step 1 of 3</span>
            <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.8px]">Which currency do you use?</h1>
            <p className="text-[15px] leading-[1.45] text-muted">Amounts across Pocket will show in this currency.</p>
          </div>
          <Card className="px-4 py-1">
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <button key={code} onClick={() => setCurrency(code)} className="flex w-full items-center gap-3 border-b border-line py-3.5 text-left last:border-0">
                <span className="flex h-9 w-12 items-center justify-center rounded-xl bg-chip text-sm font-bold">{c.symbol}</span>
                <span className="flex-1 text-[15px] font-semibold">{code} — {c.name}</span>
                {currency === code && <Icon name="check" stroke={2.4} />}
              </button>
            ))}
          </Card>
          <Button className="mt-auto" onClick={() => setStep(2)}>Continue</Button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-muted">Step 2 of 3</span>
            <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.8px]">Where do you keep your money?</h1>
            <p className="text-[15px] leading-[1.45] text-muted">Add the accounts you use and what's in them right now. You can change these any time.</p>
          </div>
          <Card className="px-4 py-1">
            {accounts.map((a, i) => (
              <button key={i} onClick={() => setEditing(i)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left last:border-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-[13px]" style={{ color: a.color, background: `color-mix(in srgb, ${a.color} 14%, var(--card))` }}>
                  <Icon name={ACCOUNT_ICON[a.type] ?? "wallet"} />
                </span>
                <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{a.name}</span><span className="num text-xs text-muted">Starting balance {formatMoney(a.startingBalance, currency)}</span></span>
                <Icon name="edit" size={16} className="text-muted" />
              </button>
            ))}
          </Card>
          <button onClick={() => { setAccounts([...accounts, { name: "", type: "wallet", startingBalance: 0, color: ACCOUNT_COLORS[(accounts.length + 2) % ACCOUNT_COLORS.length] }]); setEditing(accounts.length); }}
            className="pressable flex h-[52px] items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-faint text-[15px] font-semibold">
            <Icon name="plus" size={18} stroke={2.2} /> Add another account
          </button>
          <div className="mt-auto flex flex-col gap-2">
            <span className="num text-center text-[13px] text-muted">Starting total: {formatMoney(total, currency)}</span>
            <Button disabled={!accounts.length || accounts.some((a) => !a.name.trim())} onClick={() => setStep(3)}>Continue</Button>
            <button onClick={() => setStep(1)} className="h-10 text-sm font-semibold text-muted">Back</button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-muted">Step 3 of 3</span>
            <h1 className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.8px]">Put Pocket on your Home Screen</h1>
            <p className="text-[15px] leading-[1.45] text-muted">It then opens full-screen like a normal app, and can send you reminders.</p>
          </div>
          <Card className="flex flex-col gap-4 p-5">
            {[
              ["share", "Tap the Share button in Safari"],
              ["plus", "Choose “Add to Home Screen”"],
              ["bell", "Open Pocket from your Home Screen and turn on notifications in Settings"],
            ].map(([icon, text], i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-chip"><Icon name={icon as "share"} size={18} /></span>
                <span className="text-[15px] font-medium">{text}</span>
              </div>
            ))}
          </Card>
          {error && <p role="alert" className="rounded-2xl bg-neg-bg px-4 py-3 text-sm font-semibold text-neg">{error}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <Button loading={busy} onClick={finish}>Start using Pocket</Button>
            <button onClick={() => setStep(2)} className="h-10 text-sm font-semibold text-muted">Back</button>
          </div>
        </>
      )}

      {editing !== null && accounts[editing] && (
        <AccountEditor
          value={accounts[editing]}
          currency={currency}
          onSave={(a) => { setAccounts(accounts.map((x, i) => (i === editing ? a : x))); setEditing(null); }}
          onRemove={accounts.length > 1 ? () => { setAccounts(accounts.filter((_, i) => i !== editing)); setEditing(null); } : undefined}
          onClose={() => { if (!accounts[editing].name.trim()) setAccounts(accounts.filter((_, i) => i !== editing)); setEditing(null); }}
        />
      )}
    </main>
  );
}

function AccountEditor({ value, currency, onSave, onRemove, onClose }: { value: Acc; currency: string; onSave: (a: Acc) => void; onRemove?: () => void; onClose: () => void }) {
  const [a, setA] = useState(value);
  const [amt, setAmt] = useState(value.startingBalance ? String(value.startingBalance / 100) : "");
  const [field, setField] = useState<"name" | "amount">(value.name ? "amount" : "name");
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={value.name ? "Edit account" : "New account"} top={40}>
      <Segmented size="sm" value={field} onChange={setField} options={[{ value: "name", label: "Name & type" }, { value: "amount", label: "Balance" }]} />
      {field === "name" ? (
        <>
          <input autoFocus value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} placeholder="e.g. HBL, JazzCash" className="h-[54px] rounded-2xl bg-card px-4 text-[17px] font-semibold outline-none" maxLength={40} />
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(ACCOUNT_META).map(([t, m]) => (
              <button key={t} onClick={() => setA({ ...a, type: t, name: a.name || m.label })} className={clsx("flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-card text-xs font-semibold", a.type === t ? "border-ink" : "border-transparent")}>
                <Icon name={ACCOUNT_ICON[t]} />{m.label}
              </button>
            ))}
          </div>
          <Button onClick={() => setField("amount")} disabled={!a.name.trim()}>Next</Button>
        </>
      ) : (
        <>
          <div className="flex flex-col items-center gap-1 py-2">
            <span className="text-[13px] text-muted">What's in {a.name || "it"} right now?</span>
            <span className="num text-[44px] font-extrabold tracking-[-1.2px]">{CURRENCIES[currency]?.symbol ?? currency} {amountDisplay(amt)}</span>
          </div>
          <Keypad onKey={(k) => setAmt(applyKey(amt, k))} />
          <Button disabled={!a.name.trim()} onClick={() => onSave({ ...a, name: a.name.trim(), startingBalance: amt ? toMinor(amt) : 0 })}>Save</Button>
          {onRemove && <button onClick={onRemove} className="h-10 text-sm font-semibold text-neg">Remove account</button>}
        </>
      )}
    </Sheet>
  );
}
