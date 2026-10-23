"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/components/app";
import { CatIcon, CircleButton, Page, Segmented, Skeleton, TopBar } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";
import { useCategories } from "@/lib/hooks";
import type { CategoryJSON } from "@/lib/types";

function Categories() {
  const { open } = useApp();
  const { data } = useCategories();
  const qc = useQueryClient();
  const sp = useSearchParams();
  const router = useRouter();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [order, setOrder] = useState<CategoryJSON[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setOrder((data?.categories ?? []).filter((c) => c.type === type)); }, [data, type]);
  useEffect(() => { if (sp.get("new")) { open("category", { type }); router.replace("/categories"); } }, [sp, open, router, type]);

  const save = async (list: CategoryJSON[]) => {
    await api("/api/categories/reorder", { body: { ids: list.map((c) => c.id) } });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <Page nav={false}>
      <TopBar back="/wallets" title="Categories" right={<CircleButton icon="plus" label="New category" variant="ink" onClick={() => open("category", { type })} />} />
      <Segmented value={type} onChange={setType} options={[{ value: "expense", label: "Expenses" }, { value: "income", label: "Income" }]} />
      {!data ? <Skeleton className="h-80 !rounded-[22px]" /> : (
        <Reorder.Group axis="y" values={order} onReorder={setOrder} className="rounded-[22px] bg-card px-4 py-0.5">
          {order.map((c) => <Item key={c.id} c={c} expanded={expanded === c.id} onToggle={() => setExpanded(expanded === c.id ? null : c.id)} onDrop={() => save(order)} onEdit={() => open("category", { edit: c.id })} />)}
        </Reorder.Group>
      )}
      <p className="px-1 text-xs leading-relaxed text-muted">Drag ⋮⋮ to reorder — the first ones show up first when you add an expense. Deleting a category moves its transactions to “Other”, so nothing is lost.</p>
    </Page>
  );
}

function Item({ c, expanded, onToggle, onDrop, onEdit }: { c: CategoryJSON; expanded: boolean; onToggle: () => void; onDrop: () => void; onEdit: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={c} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="border-b border-line bg-card last:border-0">
      <div className="flex items-center gap-3 py-[11px]">
        <span onPointerDown={(e) => controls.start(e)} className="cursor-grab touch-none text-faint" aria-label="Drag to reorder"><Icon name="grip" size={16} /></span>
        <button onClick={onEdit} className="flex flex-1 items-center gap-3 text-left">
          <CatIcon emoji={c.emoji} color={c.color} size={36} />
          <span className="flex-1 text-[15px] font-semibold">{c.name}</span>
        </button>
        {c.subcategories.length > 0 && (
          <button onClick={onToggle} className="flex items-center gap-1 text-xs text-muted" aria-expanded={expanded}>
            {c.subcategories.length}<Icon name={expanded ? "down" : "chevron"} size={16} stroke={2} />
          </button>
        )}
        {c.subcategories.length === 0 && <button onClick={onEdit} aria-label={`Edit ${c.name}`} className="text-muted"><Icon name="chevron" size={16} stroke={2} /></button>}
      </div>
      {expanded && (
        <div className="flex flex-col pb-2 pl-[76px]">
          {c.subcategories.map((s) => <span key={s} className="border-b border-line py-2 text-sm last:border-0">{s}</span>)}
          <button onClick={onEdit} className="self-start py-2 text-sm font-bold text-accent">+ Add subcategory</button>
        </div>
      )}
    </Reorder.Item>
  );
}

export default function CategoriesPage() {
  return <Suspense><Categories /></Suspense>;
}
