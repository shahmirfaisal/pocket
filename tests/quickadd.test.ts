import { describe, expect, it } from "vitest";
import { parseQuickAdd, type QACategory } from "@/lib/quickadd";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { dayKey } from "@/lib/dates";

const cats: QACategory[] = DEFAULT_CATEGORIES.map((c, i) => ({ id: String(i), name: c.name, type: c.type, keywords: c.keywords ?? [], subcategories: c.subcategories ?? [], emoji: c.emoji, color: c.color }));
const accounts = [{ id: "a1", name: "Cash", type: "cash" }, { id: "a2", name: "HBL", type: "bank" }, { id: "a3", name: "JazzCash", type: "wallet" }];
const tz = "Asia/Karachi";
const now = new Date("2026-10-23T10:00:00Z");

describe("quick add", () => {
  it("reads the design example", () => {
    const r = parseQuickAdd("lunch 850 jazzcash", accounts, cats, tz, now);
    expect(r.amount).toBe(85000);
    expect(r.account?.name).toBe("JazzCash");
    expect(r.category?.name).toBe("Food");
    expect(r.type).toBe("expense");
    expect(r.note).toBe("Lunch");
    expect(r.dateLabel).toBe("Today");
  });
  it("handles dates, prefixes and tags", () => {
    const r = parseQuickAdd("petrol 3000 cash yesterday #car", accounts, cats, tz, now);
    expect(r.category?.name).toBe("Transport");
    expect(r.account?.name).toBe("Cash");
    expect(dayKey(r.date, tz)).toBe("2026-10-22");
    expect(r.tags).toEqual(["car"]);
    const j = parseQuickAdd("careem 640 jazz", accounts, cats, tz, now);
    expect(j.account?.name).toBe("JazzCash");
  });
  it("detects income", () => {
    const r = parseQuickAdd("salary +185000 hbl", accounts, cats, tz, now);
    expect(r.type).toBe("income");
    expect(r.category?.name).toBe("Salary");
    expect(r.amount).toBe(18500000);
  });
  it("supports k amounts and subcategories", () => {
    const r = parseQuickAdd("delivery 1.2k", accounts, cats, tz, now);
    expect(r.amount).toBe(120000);
    expect(r.category?.name).toBe("Food");
    expect(r.subcategory).toBe("Delivery");
  });
});
