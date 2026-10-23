"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useSheetOpen } from "../app";
import { Button, CatIcon, Segmented, Sheet, useConfirm, useToast } from "../ui";
import { api, ApiError } from "@/lib/client";
import { useCategories } from "@/lib/hooks";

const EMOJIS = ["🍔", "🛒", "🚗", "💡", "🛍️", "📱", "🎬", "💊", "🏠", "☕", "✈️", "📚", "🎁", "💇", "🐾", "⛽", "🏋️", "🍼", "🧾", "🕌", "🎮", "👕", "🧹", "🔧", "💼", "💻", "📈", "↩️", "🏷️", "✨"];
const COLORS = ["#FFF1E8", "#E6F6EE", "#E9F0FF", "#FFF6DB", "#F1ECFF", "#E8F7FA", "#FFE9EF", "#F1F2F4"];

export function CategorySheet({ edit, type, onClose }: { edit?: string; type?: "expense" | "income"; onClose: () => void }) {
  const [open, setOpen] = useSheetOpen(onClose);
  const { data } = useCategories();
  const existing = data?.categories.find((c) => c.id === edit);
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "🏷️");
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [kind, setKind] = useState<"expense" | "income">(existing?.type ?? type ?? "expense");
  const [subs, setSubs] = useState<string[]>(existing?.subcategories ?? []);
  const [keywords, setKeywords] = useState((existing?.keywords ?? []).join(", "));
  const [newSub, setNewSub] = useState("");
  const [busy, setBusy] = useState(false);
  if (edit && !existing) return <Sheet open={open} onOpenChange={setOpen} title="Category"><div className="h-40" /></Sheet>;

  const save = async () => {
    setBusy(true);
    const body = { name: name.trim(), emoji, color, type: kind, subcategories: subs, keywords: keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) };
    try {
      if (existing) await api(`/api/categories/${existing.id}`, { method: "PATCH", body });
      else await api("/api/categories", { body });
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
    if (!(await confirm({ title: `Delete ${existing!.name}?`, body: `Its transactions move to “${kind === "income" ? "Other income" : "Other"}” — nothing is lost.`, confirm: "Delete category", danger: true }))) return;
    try {
      await api(`/api/categories/${existing!.id}`, { method: "DELETE" });
      await qc.invalidateQueries();
      setOpen(false);
      router.replace("/categories");
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Couldn't delete", "error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen} title={existing ? "Edit category" : "New category"} left={<button onClick={() => setOpen(false)} className="text-[15px] font-semibold text-muted">Cancel</button>} right={null}>
      <div className="flex flex-col items-center gap-2 py-1">
        <CatIcon emoji={emoji} color={color} size={72} radius={24} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" maxLength={30} className="w-full bg-transparent text-center text-[22px] font-extrabold outline-none placeholder:text-faint" />
      </div>
      {!existing && <Segmented value={kind} onChange={setKind} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />}
      <section className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
        <div className="flex flex-wrap gap-1.5">{EMOJIS.map((e) => <button key={e} aria-pressed={e === emoji} onClick={() => setEmoji(e)} className={clsx("h-10 w-10 rounded-xl text-xl", e === emoji ? "ring-2 ring-ink" : "bg-chip")}>{e}</button>)}</div>
        <div className="flex gap-2">{COLORS.map((c) => <button key={c} aria-label={`Color ${c}`} aria-pressed={c === color} onClick={() => setColor(c)} className="tint h-8 w-8 rounded-full" style={{ ["--c" as string]: c, outline: c === color ? "2px solid var(--ink)" : "1px solid var(--line)", outlineOffset: 2 }} />)}</div>
      </section>
      <section className="flex flex-col gap-2.5 rounded-[22px] bg-card p-4">
        <span className="text-[15px] font-semibold">Subcategories</span>
        <div className="flex flex-wrap gap-2">
          {subs.map((s) => <button key={s} onClick={() => setSubs(subs.filter((x) => x !== s))} className="h-8 rounded-full bg-chip px-3 text-[13px] font-semibold">{s} ×</button>)}
          <form onSubmit={(e) => { e.preventDefault(); const v = newSub.trim(); if (v && !subs.includes(v)) setSubs([...subs, v]); setNewSub(""); }}>
            <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="+ Add" maxLength={30} className="h-8 w-28 rounded-full border border-dashed border-faint bg-transparent px-3 text-[13px] outline-none" enterKeyHint="done" />
          </form>
        </div>
      </section>
      <section className="flex flex-col gap-2 rounded-[22px] bg-card p-4">
        <span className="text-[15px] font-semibold">Quick add words</span>
        <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. lunch, kfc, foodpanda" className="h-10 rounded-xl bg-chip px-3 text-[15px] outline-none" />
        <span className="text-xs text-muted">Typing any of these in Quick add picks this category.</span>
      </section>
      <Button onClick={save} loading={busy} disabled={!name.trim()}>Save</Button>
      {existing && <Button variant="danger" size="md" onClick={remove}>Delete category</Button>}
    </Sheet>
  );
}
