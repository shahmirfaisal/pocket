import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { Budget, Category, Transaction, type UserDoc } from "@/models";
import { accessibleAccountIds, budgetProgress } from "./finance";
import { dayKey, partsIn, MONTHS_LONG } from "./dates";
import { renderReport } from "./report";
import { fromMinor } from "./money";

export async function loadRows(user: UserDoc, from: Date, to: Date) {
  const ids = await accessibleAccountIds(user._id);
  const tz = user.timezone || "Asia/Karachi";
  const txs = await Transaction.find({ $or: [{ account: { $in: ids } }, { toAccount: { $in: ids } }], date: { $gte: from, $lt: to } })
    .sort({ date: -1 })
    .populate<{ category: { name: string } | null }>("category", "name")
    .populate<{ account: { name: string; currency: string } }>("account", "name currency")
    .populate<{ toAccount: { name: string } | null }>("toAccount", "name")
    .lean();
  return txs.map((t) => ({
    date: dayKey(t.date, tz),
    time: `${String(partsIn(t.date, tz).h).padStart(2, "0")}:${String(partsIn(t.date, tz).min).padStart(2, "0")}`,
    type: t.type,
    amount: t.amount,
    currency: t.account?.currency ?? user.currency,
    account: t.account?.name ?? "",
    toAccount: t.toAccount?.name ?? "",
    category: t.category?.name ?? (t.type === "transfer" ? "Transfer" : ""),
    subcategory: t.subcategory ?? "",
    note: t.note ?? "",
    tags: (t.tags ?? []).join(" "),
  }));
}

type Row = Awaited<ReturnType<typeof loadRows>>[number];

export function toCsv(rows: Row[]) {
  return Papa.unparse(
    rows.map((r) => ({
      Date: r.date, Time: r.time, Type: r.type, Amount: fromMinor(r.amount), Currency: r.currency, Account: r.account,
      "To account": r.toAccount, Category: r.category, Subcategory: r.subcategory, Note: r.note, Tags: r.tags,
    }))
  );
}

export async function toXlsx(rows: Row[], user: UserDoc) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Pocket";
  const ws = wb.addWorksheet("Transactions", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Date", key: "date", width: 12 }, { header: "Time", key: "time", width: 8 }, { header: "Type", key: "type", width: 10 },
    { header: "Amount", key: "amount", width: 14, style: { numFmt: "#,##0.00" } }, { header: "Currency", key: "currency", width: 9 },
    { header: "Account", key: "account", width: 16 }, { header: "To account", key: "toAccount", width: 16 },
    { header: "Category", key: "category", width: 16 }, { header: "Subcategory", key: "subcategory", width: 16 },
    { header: "Note", key: "note", width: 36 }, { header: "Tags", key: "tags", width: 18 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111318" } };
  for (const r of rows) ws.addRow({ ...r, amount: (r.type === "expense" ? -1 : 1) * fromMinor(r.amount) });
  ws.autoFilter = { from: "A1", to: "K1" };

  const sum = wb.addWorksheet("By category");
  sum.columns = [{ header: "Category", key: "c", width: 22 }, { header: "Transactions", key: "n", width: 14 }, { header: `Spent (${user.currency})`, key: "t", width: 16, style: { numFmt: "#,##0.00" } }];
  sum.getRow(1).font = { bold: true };
  const by = new Map<string, { n: number; t: number }>();
  for (const r of rows.filter((x) => x.type === "expense")) {
    const v = by.get(r.category || "Uncategorised") ?? { n: 0, t: 0 };
    v.n++; v.t += r.amount;
    by.set(r.category || "Uncategorised", v);
  }
  [...by.entries()].sort((a, b) => b[1].t - a[1].t).forEach(([c, v]) => sum.addRow({ c, n: v.n, t: fromMinor(v.t) }));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(rows: Row[], user: UserDoc, from: Date, to: Date) {
  const tz = user.timezone || "Asia/Karachi";
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const spent = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const by = new Map<string, { total: number; count: number }>();
  for (const r of rows.filter((x) => x.type === "expense")) {
    const v = by.get(r.category || "Uncategorised") ?? { total: 0, count: 0 };
    v.total += r.amount; v.count++;
    by.set(r.category || "Uncategorised", v);
  }
  const fp = partsIn(from, tz), tp = partsIn(new Date(to.getTime() - 1), tz);
  const sameMonth = fp.y === tp.y && fp.m === tp.m;
  const budgets = sameMonth
    ? await Promise.all((await Budget.find({ user: user._id, period: "monthly" }).lean()).map(async (b) => {
        const p = await budgetProgress(user, b, from);
        const c = b.category ? await Category.findById(b.category).select("name").lean() : null;
        return { name: c?.name ?? "Overall", spent: p.spent, limit: p.limit };
      }))
    : [];
  return renderReport({
    title: sameMonth ? `${MONTHS_LONG[fp.m - 1]} ${fp.y}` : "Spending report",
    subtitle: `${dayKey(from, tz)} to ${dayKey(new Date(to.getTime() - 1), tz)} · ${user.name}`,
    currency: user.currency,
    income, spent,
    categories: [...by.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
    budgets,
    transactions: rows.slice(0, 600).map((r) => ({ date: r.date, note: r.note, category: r.category + (r.subcategory ? ` · ${r.subcategory}` : ""), account: r.account, type: r.type, amount: r.amount })),
  });
}
