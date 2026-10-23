export function serializeCategory(c: { _id: unknown; name: string; emoji?: string | null; color?: string | null; type?: string | null; subcategories?: string[]; keywords?: string[]; order?: number | null }) {
  return {
    id: String(c._id),
    name: c.name,
    emoji: c.emoji ?? "🏷️",
    color: c.color ?? "#F1F2F4",
    type: (c.type ?? "expense") as "expense" | "income",
    subcategories: c.subcategories ?? [],
    keywords: c.keywords ?? [],
    order: c.order ?? 0,
  };
}
export type CategoryJSON = ReturnType<typeof serializeCategory>;

type PopCat = { _id: unknown; name: string; emoji?: string | null; color?: string | null } | null | undefined;
type PopAcc = { _id: unknown; name: string; color?: string | null; type?: string | null } | null | undefined;
type PopUser = { _id: unknown; name: string } | null | undefined;

export function serializeTx(
  t: {
    _id: unknown; type: string; amount: number; note?: string | null; tags?: string[]; date: Date; subcategory?: string | null;
    receipt?: string | null; recurring?: unknown; createdAt?: Date;
    category?: PopCat | unknown; account?: PopAcc | unknown; toAccount?: PopAcc | unknown; user?: PopUser | unknown;
  },
  viewerId?: string
) {
  const cat = t.category as PopCat;
  const acc = t.account as PopAcc;
  const to = t.toAccount as PopAcc;
  const by = t.user as PopUser;
  const ref = (x: { _id: unknown } | null | undefined | unknown) => (x && typeof x === "object" && "_id" in (x as object) ? String((x as { _id: unknown })._id) : x ? String(x) : null);
  return {
    id: String(t._id),
    type: t.type as "expense" | "income" | "transfer",
    amount: t.amount,
    note: t.note ?? "",
    tags: t.tags ?? [],
    date: t.date.toISOString(),
    subcategory: t.subcategory ?? null,
    receipt: t.receipt ?? null,
    recurring: t.recurring ? String(t.recurring) : null,
    category: cat && typeof cat === "object" && "name" in cat ? { id: String(cat._id), name: cat.name, emoji: cat.emoji ?? "🏷️", color: cat.color ?? "#F1F2F4" } : null,
    account: acc && typeof acc === "object" && "name" in acc ? { id: String(acc._id), name: acc.name, color: acc.color ?? "#2F5BEA" } : { id: ref(acc) ?? "", name: "", color: "#2F5BEA" },
    toAccount: to && typeof to === "object" && "name" in to ? { id: String(to._id), name: to.name, color: to.color ?? "#2F5BEA" } : null,
    by: by && typeof by === "object" && "name" in by ? { id: String(by._id), name: by.name, me: String(by._id) === viewerId } : null,
  };
}
export type TxJSON = ReturnType<typeof serializeTx>;

export const TX_POPULATE = [
  { path: "category", select: "name emoji color" },
  { path: "account", select: "name color type" },
  { path: "toAccount", select: "name color type" },
  { path: "user", select: "name" },
];
