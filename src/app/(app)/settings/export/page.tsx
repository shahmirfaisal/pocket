"use client";
import { useRef, useState } from "react";
import Papa from "papaparse";
import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/components/app";
import { Button, Card, Chip, Page, Sheet, TopBar, useConfirm, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError, download } from "@/lib/client";
import { useAccounts, useReportsInfo } from "@/lib/hooks";
import { monthRange, yearRange } from "@/lib/dates";
import { toMinor } from "@/lib/money";

type Range = "month" | "last" | "year" | "all" | "custom";

export default function ExportPage() {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const info = useReportsInfo();
  const [range, setRange] = useState<Range>("month");
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [importing, setImporting] = useState<Record<string, string>[] | null>(null);
  const restoreRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const bounds = () => {
    const now = new Date();
    if (range === "month") return monthRange(now, user.timezone, user.monthStartDay);
    if (range === "last") return monthRange(now, user.timezone, user.monthStartDay, -1);
    if (range === "year") return yearRange(now, user.timezone);
    if (range === "all") return { start: new Date("2000-01-01"), end: new Date(Date.now() + 86400000) };
    return { start: new Date(from + "T00:00"), end: new Date(new Date(to + "T00:00").getTime() + 86400000) };
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast(e instanceof ApiError ? e.message : (e as Error).message || "That didn't work", "error"); } finally { setBusy(null); }
  };

  const exportNow = () => run("export", async () => {
    const b = bounds();
    await download(`/api/export?format=${format}&from=${b.start.toISOString()}&to=${b.end.toISOString()}`, `pocket.${format}`);
  });

  const restore = async (file: File) => {
    if (!(await confirm({ title: "Restore this backup?", body: "Everything currently in your Pocket account will be replaced with the backup. Shared wallets are left as they are.", confirm: "Replace and restore", danger: true }))) return;
    await run("restore", async () => {
      const r = await api<{ counts: { transactions: number } }>("/api/restore", { method: "POST", body: JSON.parse(await file.text()) });
      await qc.invalidateQueries();
      toast(`Restored ${r.counts.transactions} transactions`);
    });
  };

  const readCsv = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => (res.data.length ? setImporting(res.data) : toast("That file has no rows", "error")),
      error: () => toast("Couldn't read that CSV", "error"),
    });
  };

  const lastBackup = info.data?.lastBackup ? Math.round((Date.now() - new Date(info.data.lastBackup).getTime()) / 86400000) : null;

  return (
    <Page nav={false}>
      <TopBar back="/settings" title="Export & backup" />
      <Card className="flex flex-col gap-3.5 p-4">
        <span className="text-[15px] font-bold">Export transactions</span>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {([["month", "This month"], ["last", "Last month"], ["year", "This year"], ["all", "Everything"], ["custom", "Custom"]] as const).map(([k, l]) => (
            <Chip key={k} active={range === k} onClick={() => setRange(k)} className={range === k ? "" : "!bg-chip"}>{l}</Chip>
          ))}
        </div>
        {range === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 rounded-[14px] bg-chip px-3 py-2"><span className="text-xs text-muted">From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent font-semibold outline-none" /></label>
            <label className="flex flex-col gap-1 rounded-[14px] bg-chip px-3 py-2"><span className="text-xs text-muted">To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-transparent font-semibold outline-none" /></label>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {([["csv", "CSV", "Any app"], ["xlsx", "Excel", ".xlsx"], ["pdf", "PDF", "With charts"]] as const).map(([k, l, s]) => (
            <button key={k} aria-pressed={format === k} onClick={() => setFormat(k)} className={clsx("flex h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border-2", format === k ? "border-ink" : "border-seg")}>
              <span className="text-[15px] font-extrabold">{l}</span><span className="text-[11px] text-muted">{s}</span>
            </button>
          ))}
        </div>
        <Button size="md" loading={busy === "export"} disabled={range === "custom" && (!from || !to)} onClick={exportNow}>Export {format.toUpperCase()}</Button>
      </Card>

      {info.data && (
        <Card className="flex flex-col gap-2.5 p-4">
          <span className="text-[15px] font-bold">Monthly report</span>
          <div className="flex items-center gap-3">
            <div aria-hidden className="flex h-[66px] w-[52px] flex-col gap-1 rounded-lg border border-seg bg-bg px-[7px] py-2"><span className="h-1 w-[70%] rounded-sm bg-ink" /><span className="h-[18px] rounded bg-[#FBD3C2]" /><span className="h-[3px] rounded-sm bg-seg" /><span className="h-[3px] w-4/5 rounded-sm bg-seg" /></div>
            <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{info.data.lastMonth.label}</span><span className="text-xs text-muted">Spending, budgets and every transaction · PDF</span></span>
            <button onClick={() => run("report", () => download(`/api/export?format=pdf&from=${info.data!.lastMonth.from}&to=${info.data!.lastMonth.to}`, "report.pdf"))} className="h-9 rounded-xl bg-chip px-3.5 text-[13px] font-bold">{busy === "report" ? "…" : "Share"}</button>
          </div>
        </Card>
      )}

      <span className="-mb-2 px-1 text-[13px] font-semibold text-muted">Your data</span>
      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        <button onClick={() => csvRef.current?.click()} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="upload" size={18} /></span>
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Import from CSV</span><span className="text-xs text-muted">From your bank or another app</span></span>
          <Icon name="chevron" size={16} stroke={2} className="text-muted" />
        </button>
        <button onClick={() => run("backup", () => download("/api/backup", "pocket-backup.json").then(() => { info.refetch(); }))} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="cloud" size={18} /></span>
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">{busy === "backup" ? "Preparing backup…" : "Download full backup"}</span><span className="text-xs text-muted">{lastBackup === null ? "Never backed up" : lastBackup === 0 ? "Last backup today" : `Last backup ${lastBackup} ${lastBackup === 1 ? "day" : "days"} ago`} · {info.data?.count ?? 0} transactions</span></span>
          <Icon name="chevron" size={16} stroke={2} className="text-muted" />
        </button>
        <button onClick={() => restoreRef.current?.click()} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="restore" size={18} /></span>
          <span className="flex-1 text-[15px] font-semibold">{busy === "restore" ? "Restoring…" : "Restore from backup"}</span>
          <Icon name="chevron" size={16} stroke={2} className="text-muted" />
        </button>
      </Card>
      <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readCsv(f); e.target.value = ""; }} />
      <input ref={restoreRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ""; }} />
      {importing && <ImportSheet rows={importing} onClose={() => setImporting(null)} />}
    </Page>
  );
}

const GUESS: Record<string, string[]> = {
  date: ["date", "transaction date", "posted", "posting date", "value date", "time"],
  amount: ["amount", "value", "sum", "debit/credit", "amount (pkr)"],
  debit: ["debit", "withdrawal", "money out", "paid out"],
  credit: ["credit", "deposit", "money in", "paid in"],
  type: ["type", "kind"],
  category: ["category", "categories"],
  account: ["account", "wallet"],
  note: ["note", "notes", "description", "details", "narration", "memo", "payee", "merchant"],
};

function parseDate(s: string) {
  if (!s) return null;
  const t = s.trim();
  const dmy = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dmy) {
    const y = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return new Date(y, Number(dmy[2]) - 1, Number(dmy[1]), 12);
  }
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function ImportSheet({ rows, onClose }: { rows: Record<string, string>[]; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data } = useAccounts();
  const cols = Object.keys(rows[0] ?? {});
  const guess = (k: string) => cols.find((c) => GUESS[k].includes(c.trim().toLowerCase())) ?? "";
  const [map, setMap] = useState<Record<string, string>>(() => Object.fromEntries(Object.keys(GUESS).map((k) => [k, guess(k)])));
  const [account, setAccount] = useState("");
  const [expensesNegative, setExpensesNegative] = useState(true);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const close = (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); };

  const parsed = rows.map((r) => {
    const date = parseDate(r[map.date]);
    let amount = NaN;
    if (map.amount && r[map.amount]) {
      const raw = r[map.amount].replace(/[^\d.,-]/g, "").replace(/,/g, "");
      const neg = raw.startsWith("-") || /\(.*\)/.test(r[map.amount]);
      amount = toMinor(raw.replace("-", "")) * (neg ? -1 : 1);
      if (!expensesNegative) amount = -amount;
    } else if (map.debit || map.credit) {
      const d = toMinor((r[map.debit] || "0").replace(/,/g, "").replace(/[^\d.]/g, "") || "0");
      const c = toMinor((r[map.credit] || "0").replace(/,/g, "").replace(/[^\d.]/g, "") || "0");
      amount = c - d;
    }
    const t = (r[map.type] || "").toLowerCase();
    const type = t.includes("inc") || t.includes("credit") ? "income" : t.includes("exp") || t.includes("debit") ? "expense" : undefined;
    return { date, amount: type === "expense" ? -Math.abs(amount) : type === "income" ? Math.abs(amount) : amount, category: r[map.category] || "", account: r[map.account] || "", note: r[map.note] || "" };
  });
  const valid = parsed.filter((p) => p.date && !isNaN(p.amount) && p.amount !== 0);

  const go = async () => {
    setBusy(true);
    try {
      const r = await api<{ imported: number }>("/api/import", { body: { defaultAccount: account || undefined, rows: valid.map((p) => ({ ...p, date: p.date!.toISOString(), type: p.amount < 0 ? "expense" : "income" })) } });
      await qc.invalidateQueries();
      toast(`Imported ${r.imported} transactions`);
      close(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Import failed", "error");
      setBusy(false);
    }
  };

  const Pick = ({ k, label }: { k: string; label: string }) => (
    <label className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
      <span className="w-24 text-sm text-muted">{label}</span>
      <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })} className="flex-1 appearance-none bg-transparent text-sm font-semibold outline-none">
        <option value="">—</option>{cols.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );

  return (
    <Sheet open={open} onOpenChange={close} title="Import CSV" top={40}>
      <p className="-mt-2 text-sm text-muted">Found {rows.length} rows. Match the columns, then import.</p>
      <Card className="px-4 py-0.5">
        <Pick k="date" label="Date" /><Pick k="amount" label="Amount" /><Pick k="debit" label="Money out" /><Pick k="credit" label="Money in" />
        <Pick k="type" label="Type" /><Pick k="category" label="Category" /><Pick k="account" label="Account" /><Pick k="note" label="Note" />
      </Card>
      {map.amount && (
        <button onClick={() => setExpensesNegative(!expensesNegative)} className="flex items-center gap-2 px-1 text-left text-sm">
          <span className={clsx("flex h-5 w-5 items-center justify-center rounded-md border-2", expensesNegative ? "border-ink bg-ink text-bg" : "border-faint")}>{expensesNegative && <Icon name="check" size={12} stroke={3} />}</span>
          Spending is negative in this file (e.g. -850)
        </button>
      )}
      {!map.account && (
        <label className="flex flex-col gap-1.5"><span className="text-[13px] font-semibold text-muted">Put everything in</span>
          <select value={account} onChange={(e) => setAccount(e.target.value)} className="h-12 rounded-2xl bg-card px-4 text-[15px] font-semibold outline-none">
            <option value="">Default account</option>{(data?.accounts ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      <Card className="px-4 py-1 text-[13px]">
        {valid.slice(0, 4).map((p, i) => (
          <div key={i} className="flex justify-between gap-3 border-b border-line py-2 last:border-0"><span className="truncate">{p.date!.toLocaleDateString()} · {p.note || p.category || "—"}</span><span className={clsx("num font-bold", p.amount > 0 && "text-income")}>{(p.amount / 100).toLocaleString()}</span></div>
        ))}
        {!valid.length && <p className="py-3 text-center text-muted">Pick the date and amount columns to see a preview.</p>}
      </Card>
      <Button loading={busy} disabled={!valid.length} onClick={go}>Import {valid.length} transactions</Button>
    </Sheet>
  );
}
