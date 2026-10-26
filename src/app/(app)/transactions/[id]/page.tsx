"use client";
import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app";
import { Button, Card, Page, Skeleton, TopBar, TxAmount, Money, useConfirm, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { TxIcon, txTitle, dayLabel, timeLabel } from "@/components/tx";
import { api, ApiError, saveTransaction } from "@/lib/client";
import { useQueryClient } from "@tanstack/react-query";
import { refreshAfterDelete, useTransaction } from "@/lib/hooks";
import { partsIn, MONTHS } from "@/lib/dates";

export default function TransactionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, open } = useApp();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const { data, error } = useTransaction(id);
  const [viewing, setViewing] = useState(false);
  const qc = useQueryClient();
  const remove = async () => {
    const done = await confirm({
      title: "Delete this transaction?", confirm: "Delete", danger: true,
      action: async () => {
        await api(`/api/transactions/${id}`, { method: "DELETE" });
        await refreshAfterDelete(qc, ["transaction", id]);
      },
    });
    if (!done) return;
    toast("Deleted");
    router.back();
  };
  const t = data?.transaction;

  if (error) return <Page nav={false}><TopBar back="/activity" /><p className="p-6 text-center text-muted">{(error as ApiError).message}</p></Page>;
  if (!t) return <Page nav={false}><TopBar back="/activity" /><Skeleton className="mx-auto h-40 w-full !rounded-3xl" /><Skeleton className="h-48 w-full !rounded-3xl" /></Page>;

  const p = partsIn(new Date(t.date), user.timezone);
  const duplicate = async () => {
    try {
      await saveTransaction({ type: t.type, amount: t.amount, account: t.account.id, toAccount: t.toAccount?.id ?? null, category: t.category?.id ?? null, subcategory: t.subcategory, note: t.note, tags: t.tags, date: new Date().toISOString() });
      toast("Added again for today");
      router.push("/activity");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't duplicate", "error");
    }
  };

  return (
    <Page nav={false}>
      <TopBar back="/activity" right={<button onClick={() => open("add", { edit: t.id })} className="pressable h-11 rounded-full bg-card px-[18px] text-[15px] font-bold">Edit</button>} />
      <div className="flex flex-col items-center gap-2.5 pb-1 pt-1.5">
        <TxIcon t={t} size={64} />
        <span className="text-base font-semibold">{txTitle(t)}</span>
        <TxAmount type={t.type} amount={t.amount} currency={user.currency} className="text-[40px] !font-extrabold leading-none tracking-[-1px]" />
        <span className="text-[13px] text-muted">{dayLabel(t.date, user.timezone).replace(/^(Today|Yesterday)$/, `$1, ${p.d} ${MONTHS[p.m - 1]} ${p.y}`)} · {timeLabel(t.date, user.timezone)}</span>
      </div>

      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        {t.type === "transfer" ? (
          <>
            <Line k="From" v={<Link href={`/wallets/${t.account.id}`}>{t.account.name}</Link>} />
            <Line k="To" v={t.toAccount ? <Link href={`/wallets/${t.toAccount.id}`}>{t.toAccount.name}</Link> : "—"} />
          </>
        ) : (
          <>
            <Line k="Category" v={t.category ? <Link href={`/categories/${t.category.id}`}>{t.category.name}{t.subcategory ? ` · ${t.subcategory}` : ""}</Link> : "Uncategorised"} />
            <Line k={t.type === "income" ? "Paid into" : "Paid from"} v={<Link href={`/wallets/${t.account.id}`}>{t.account.name}</Link>} />
          </>
        )}
        {t.by && !t.by.me && <Line k="Added by" v={t.by.name} />}
        {t.tags.length > 0 && <Line k="Tags" v={<span className="flex flex-wrap justify-end gap-1.5">{t.tags.map((x) => <Link key={x} href={`/activity?q=${encodeURIComponent(x)}`} className="rounded-[10px] bg-chip px-2.5 py-0.5 text-[13px] font-semibold">#{x}</Link>)}</span>} />}
        {data.splits.length > 0 && (
          <Line k="Split" v={<Link href="/splits">{data.splits.map((s) => s.person.name).join(", ")} · <Money value={data.splits.reduce((a, s) => a + (s.settled ? 0 : s.amount), 0)} currency={user.currency} /> owed</Link>} />
        )}
        {t.recurring && <Line k="Repeats" v={<Link href="/recurring">Recurring</Link>} />}
      </Card>

      {t.receipt && (
        <button onClick={() => setViewing(true)} className="flex items-center gap-3 rounded-[22px] bg-card p-3 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/receipts/${t.receipt}`} alt="Receipt" className="h-[76px] w-16 rounded-xl object-cover" />
          <span className="flex flex-1 flex-col gap-0.5"><span className="text-[15px] font-semibold">Receipt</span><span className="text-[13px] text-muted">Tap to view</span></span>
          <Icon name="chevron" size={16} className="text-muted" />
        </button>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2.5 pt-4">
        <Button variant="secondary" size="md" onClick={duplicate}>Duplicate</Button>
        <Button variant="danger" size="md" onClick={remove}>Delete</Button>
      </div>

      {viewing && t.receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setViewing(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/receipts/${t.receipt}`} alt="Receipt" className="max-h-full max-w-full rounded-xl" />
          <button aria-label="Close" className="absolute right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}><Icon name="close" size={16} /></button>
        </div>
      )}
    </Page>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 text-[15px]">
      <span className="text-muted">{k}</span>
      <span className="text-right font-semibold">{v}</span>
    </div>
  );
}
