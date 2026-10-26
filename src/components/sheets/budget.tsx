"use client";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useApp, useSheetOpen } from "../app";
import { Button, CatIcon, Keypad, Segmented, Sheet, Toggle, amountDisplay, applyKey, useConfirm, useToast } from "../ui";
import { Icon } from "../icons";
import { api, ApiError } from "@/lib/client";
import { refreshAfterDelete, useCategories, useGoal } from "@/lib/hooks";
import { formatMoney, symbolFor } from "@/lib/money";
import { CategoryPicker } from "./add";
import { useQueryClient } from "@tanstack/react-query";
import { monthRange } from "@/lib/dates";

type BudgetData = { budget: { id: string; category: string | null; amount: number; period: "weekly" | "monthly" | "yearly"; rollover: boolean; alerts: number[] } };

export function BudgetSheet({ edit, mode, goal, onClose }: { edit?: string; mode?: "budget" | "goal"; goal?: string; onClose: () => void }) {
  const [open, setOpen] = useSheetOpen(onClose);
  const b = useQuery({ queryKey: ["budget", edit], enabled: !!edit, queryFn: () => api<BudgetData>(`/api/budgets/${edit}`) });
  const g = useGoal(goal ?? "");
  if ((edit && !b.data) || (goal && !g.data)) return <Sheet open={open} onOpenChange={setOpen} title="Edit"><div className="h-40" /></Sheet>;
  return <BudgetForm open={open} setOpen={setOpen} initialMode={goal ? "goal" : mode ?? "budget"} budget={b.data?.budget} goal={g.data?.goal} />;
}

function BudgetForm({ open, setOpen, initialMode, budget, goal }: { open: boolean; setOpen: (o: boolean) => void; initialMode: "budget" | "goal"; budget?: BudgetData["budget"]; goal?: { id: string; name: string; emoji: string; target: number; targetDate: string | null } }) {
  const { user } = useApp();
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: catData } = useCategories();
  const editing = !!budget || !!goal;
  const [mode, setMode] = useState<"budget" | "goal">(initialMode);
  const [amount, setAmount] = useState(budget ? String(budget.amount / 100) : goal ? String(goal.target / 100) : "");
  const [category, setCategory] = useState<string | null>(budget?.category ?? null);
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">(budget?.period ?? "monthly");
  const [rollover, setRollover] = useState(budget?.rollover ?? false);
  const [alerts, setAlerts] = useState<number[]>(budget?.alerts ?? [80, 100]);
  const [name, setName] = useState(goal?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🎯");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ? goal.targetDate.slice(0, 10) : "");
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastMonth, setLastMonth] = useState<number | null>(null);

  const cats = (catData?.categories ?? []).filter((c) => c.type === "expense");
  const cat = cats.find((c) => c.id === category);
  const minor = Math.round(parseFloat(amount || "0") * 100);

  useEffect(() => {
    if (mode !== "budget") return;
    const r = monthRange(new Date(), user.timezone, user.monthStartDay, -1);
    const qs = new URLSearchParams({ type: "expense", from: r.start.toISOString(), to: r.end.toISOString(), limit: "1" });
    if (category) qs.set("category", category);
    api<{ totals?: { expense: number } }>(`/api/transactions?${qs}`).then((d) => setLastMonth(d.totals?.expense ?? 0)).catch(() => setLastMonth(null));
  }, [category, mode, user.timezone, user.monthStartDay]);

  const save = async () => {
    setBusy(true);
    try {
      if (mode === "budget") {
        const body = { category, amount: minor, period, rollover, alerts };
        if (budget) await api(`/api/budgets/${budget.id}`, { method: "PATCH", body });
        else await api("/api/budgets", { body });
        toast(budget ? "Budget saved" : "Budget created");
      } else {
        const body = { name: name.trim(), emoji, target: minor, targetDate: targetDate ? new Date(targetDate).toISOString() : null };
        if (goal) await api(`/api/goals/${goal.id}`, { method: "PATCH", body });
        else {
          const r = await api<{ id: string }>("/api/goals", { body });
          router.push(`/goals/${r.id}`);
        }
        toast(goal ? "Goal saved" : "Goal created");
      }
      await qc.invalidateQueries();
      setOpen(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't save", "error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const what = mode === "budget" ? "budget" : "goal";
    const done = await confirm({
      title: `Delete this ${what}?`, confirm: "Delete", danger: true,
      action: async () => {
        await api(mode === "budget" ? `/api/budgets/${budget!.id}` : `/api/goals/${goal!.id}`, { method: "DELETE" });
        await (mode === "goal" ? refreshAfterDelete(qc, ["goal", goal!.id]) : qc.invalidateQueries());
      },
    });
    if (!done) return;
    toast("Deleted");
    setOpen(false);
    if (mode === "goal") router.replace("/budgets");
  };

  const EMOJIS = ["🎯", "💻", "📱", "🚗", "🏠", "✈️", "💍", "🎓", "🛟", "🎮", "🕋", "🏍️"];
  const valid = minor > 0 && (mode === "budget" || name.trim());

  return (
    <Sheet open={open} onOpenChange={setOpen} title={editing ? (mode === "budget" ? "Edit budget" : "Edit goal") : mode === "budget" ? "New budget" : "New goal"} left={<button onClick={() => setOpen(false)} className="text-[15px] font-semibold text-muted">Cancel</button>} right={null}>
      {!editing && <Segmented value={mode} onChange={setMode} options={[{ value: "budget", label: "Budget" }, { value: "goal", label: "Savings goal" }]} />}

      <div className="flex flex-col items-center gap-1 py-1">
        <span className="text-[13px] text-muted">{mode === "budget" ? `${period[0].toUpperCase()}${period.slice(1, -2)} limit` : "Target"}</span>
        <span className="num text-[44px] font-extrabold tracking-[-1.4px]">{symbolFor(user.currency)} {amountDisplay(amount)}</span>
        {mode === "budget" && lastMonth !== null && <span className="num text-[13px] text-muted">You spent {formatMoney(lastMonth, user.currency)} on {cat ? cat.name.toLowerCase() : "everything"} last month</span>}
      </div>

      {mode === "budget" ? (
        <section className="rounded-[22px] bg-card px-4 py-0.5">
          <button onClick={() => setPicking(true)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
            {cat ? <CatIcon emoji={cat.emoji} color={cat.color} size={36} /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="pie" size={18} /></span>}
            <span className="flex flex-1 flex-col gap-0.5"><span className="text-xs text-muted">Category</span><span className="text-[15px] font-bold">{cat?.name ?? "All spending"}</span></span>
            <Icon name="chevron" size={16} className="text-muted" />
          </button>
          <div className="flex items-center gap-3 border-b border-line py-3">
            <span className="flex-1 text-[15px] font-semibold">Repeats</span>
            <div className="w-[210px]"><Segmented size="sm" value={period} onChange={setPeriod} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} /></div>
          </div>
          <div className="flex items-center gap-3 border-b border-line py-3">
            <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Roll over leftovers</span><span className="text-xs text-muted">Unspent money carries to the next {period.replace("ly", "")}</span></span>
            <Toggle label="Roll over leftovers" checked={rollover} onChange={setRollover} />
          </div>
          <div className="flex flex-col gap-2.5 py-3">
            <span className="text-[15px] font-semibold">Alert me at</span>
            <div className="flex gap-2">
              {[50, 80, 100].map((a) => (
                <button key={a} aria-pressed={alerts.includes(a)} onClick={() => setAlerts(alerts.includes(a) ? alerts.filter((x) => x !== a) : [...alerts, a].sort((x, y) => x - y))} className={clsx("h-[34px] rounded-full px-3.5 text-[13px]", alerts.includes(a) ? "bg-ink font-bold text-bg" : "bg-chip font-semibold")}>{a}%</button>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[22px] bg-card px-4 py-0.5">
          <label className="flex items-center gap-3 border-b border-line py-3"><span className="w-[100px] text-[15px] text-muted">Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="New laptop" maxLength={40} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
          <div className="flex flex-col gap-2 border-b border-line py-3">
            <span className="text-[15px] text-muted">Icon</span>
            <div className="flex flex-wrap gap-1.5">{EMOJIS.map((e) => <button key={e} onClick={() => setEmoji(e)} className={clsx("h-10 w-10 rounded-xl text-xl", e === emoji ? "bg-ink" : "bg-chip")}>{e}</button>)}</div>
          </div>
          <label className="flex items-center gap-3 py-3"><span className="w-[100px] text-[15px] text-muted">Target date</span><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" /></label>
        </section>
      )}

      <Keypad onKey={(k) => setAmount(applyKey(amount, k))} />
      <Button onClick={save} loading={busy} disabled={!valid}>{editing ? "Save" : mode === "budget" ? "Create budget" : "Create goal"}</Button>
      {editing && <Button variant="danger" size="md" onClick={remove}>Delete {mode}</Button>}

      {picking && (
        <CategoryPickerWithAll cats={cats} value={category} onPick={(c) => { setCategory(c); setPicking(false); }} onClose={() => setPicking(false)} />
      )}
    </Sheet>
  );
}

function CategoryPickerWithAll({ cats, value, onPick, onClose }: { cats: import("@/lib/types").CategoryJSON[]; value: string | null; onPick: (c: string | null) => void; onClose: () => void }) {
  const [showAll, setShowAll] = useState(true);
  if (!showAll) return <CategoryPicker cats={cats.map((c) => ({ ...c, subcategories: [] }))} value={value} sub={null} onPick={(c) => onPick(c)} onClose={onClose} />;
  return (
    <Sheet nested open onOpenChange={(o) => !o && onClose()} title="Budget for" top={200}>
      <div className="rounded-[22px] bg-card px-4 py-0.5">
        <button onClick={() => onPick(null)} className="flex w-full items-center gap-3 border-b border-line py-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="pie" size={18} /></span>
          <span className="flex-1 text-[15px] font-semibold">All spending</span>{!value && <Icon name="check" stroke={2.4} />}
        </button>
        <button onClick={() => setShowAll(false)} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip"><Icon name="grid" size={18} /></span>
          <span className="flex-1 text-[15px] font-semibold">One category…</span><Icon name="chevron" size={16} className="text-muted" />
        </button>
      </div>
    </Sheet>
  );
}
