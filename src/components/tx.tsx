"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, animate } from "motion/react";
import { useRef } from "react";
import { CatIcon, Money, TxAmount, useConfirm, useToast } from "./ui";
import { Icon } from "./icons";
import { useApp } from "./app";
import { api, haptic } from "@/lib/client";
import { dayKey, partsIn, MONTHS, WEEKDAYS } from "@/lib/dates";
import { useAction } from "@/lib/hooks";
import type { TxJSON } from "@/lib/types";

export function dayLabel(iso: string | Date, tz: string) {
  const d = new Date(iso);
  const today = dayKey(new Date(), tz);
  const k = dayKey(d, tz);
  if (k === today) return "Today";
  if (k === dayKey(new Date(Date.now() - 86400000), tz)) return "Yesterday";
  const p = partsIn(d, tz);
  const n = partsIn(new Date(), tz);
  return `${WEEKDAYS[p.wd]}, ${p.d} ${MONTHS[p.m - 1]}${p.y !== n.y ? ` ${p.y}` : ""}`;
}

export function timeLabel(iso: string, tz: string) {
  const p = partsIn(new Date(iso), tz);
  const h = p.h % 12 || 12;
  return `${h}:${String(p.min).padStart(2, "0")} ${p.h < 12 ? "AM" : "PM"}`;
}

export function txTitle(t: TxJSON) {
  if (t.note) return t.note;
  if (t.type === "transfer") return `${t.account.name} → ${t.toAccount?.name ?? ""}`;
  return t.category?.name ?? (t.type === "income" ? "Income" : "Expense");
}

export function txSub(t: TxJSON) {
  if (t.type === "transfer") return "Transfer";
  const parts = [t.category?.name ?? "Uncategorised"];
  if (t.subcategory) parts[0] += ` · ${t.subcategory}`;
  parts.push(t.account.name);
  if (t.by && !t.by.me) parts.push(t.by.name.split(" ")[0]);
  return parts.join(" · ");
}

export function TxIcon({ t, size = 42 }: { t: TxJSON; size?: number }) {
  if (t.type === "transfer")
    return (
      <span className="flex flex-none items-center justify-center bg-chip text-ink" style={{ width: size, height: size, borderRadius: size / 3 }}>
        <Icon name="swap" size={size / 2.1} />
      </span>
    );
  return <CatIcon emoji={t.category?.emoji ?? "🏷️"} color={t.category?.color} size={size} radius={size / 3} />;
}

const ACTION_W = 136;

/** A transaction row that swipes left to reveal Edit and Delete, like iOS Mail. */
export function TxRow({ t, currency, showTime, swipe = true }: { t: TxJSON; currency: string; showTime?: string; swipe?: boolean }) {
  const x = useMotionValue(0);
  const router = useRouter();
  const { open } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const dragged = useRef(false);
  const del = useAction(() => api(`/api/transactions/${t.id}`, { method: "DELETE" }), { onSuccess: () => toast("Deleted") });

  const close = () => animate(x, 0, { type: "spring", stiffness: 500, damping: 40 });
  const content = (
    <>
      <TxIcon t={t} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{txTitle(t)}</span>
        <span className="truncate text-xs text-muted">{txSub(t)}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <TxAmount type={t.type} amount={t.amount} currency={currency} className="text-[15px]" />
        {showTime && <span className="text-xs text-muted">{showTime}</span>}
      </div>
    </>
  );

  if (!swipe) {
    return <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 py-[11px] active:opacity-60">{content}</Link>;
  }

  return (
    <div className="relative -mx-4 overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTION_W }}>
        <button onClick={() => { close(); open("add", { edit: t.id }); }} className="flex flex-1 flex-col items-center justify-center gap-1 bg-[#5F6672] text-xs font-semibold text-white">
          <Icon name="edit" size={18} />Edit
        </button>
        <button
          onClick={async () => {
            close();
            if (await confirm({ title: "Delete this transaction?", body: `${txTitle(t)} will be removed.`, confirm: "Delete", danger: true })) del.mutate(undefined);
          }}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-[#D6402A] text-xs font-semibold text-white"
        >
          <Icon name="trash" size={18} />Delete
        </button>
      </div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -ACTION_W, right: 0 }}
        dragElastic={{ left: 0.15, right: 0 }}
        style={{ x }}
        onDragStart={() => { dragged.current = true; }}
        onDragEnd={(_, info) => {
          const open = info.offset.x < -ACTION_W / 2 || info.velocity.x < -400;
          animate(x, open ? -ACTION_W : 0, { type: "spring", stiffness: 500, damping: 40 });
          if (open) haptic(6);
          setTimeout(() => (dragged.current = false), 50);
        }}
        onClick={() => {
          if (dragged.current) return;
          if (x.get() < -10) return void close();
          router.push(`/transactions/${t.id}`);
        }}
        className="relative flex cursor-pointer items-center gap-3 bg-card px-4 py-[11px]"
      >
        {content}
      </motion.div>
    </div>
  );
}

/** Transactions grouped by day, each group in its own card. */
export function TxGroups({ txs, currency, tz }: { txs: TxJSON[]; currency: string; tz: string }) {
  const groups: { key: string; label: string; items: TxJSON[]; net: number }[] = [];
  for (const t of txs) {
    const k = dayKey(new Date(t.date), tz);
    let g = groups[groups.length - 1];
    if (!g || g.key !== k) { g = { key: k, label: dayLabel(t.date, tz), items: [], net: 0 }; groups.push(g); }
    g.items.push(t);
    g.net += t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0;
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2">
          <div className="flex justify-between px-1 pt-1.5 text-[13px] text-muted">
            <span className="font-semibold">{g.label}</span>
            <Money value={g.net} currency={currency} sign />
          </div>
          <div className="overflow-hidden rounded-[22px] bg-card px-4 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
            {g.items.map((t) => <TxRow key={t.id} t={t} currency={currency} />)}
          </div>
        </div>
      ))}
    </>
  );
}
