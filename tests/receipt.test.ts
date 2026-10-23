import { describe, expect, it } from "vitest";
import { parseReceipt } from "@/lib/receipt";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

const cats = DEFAULT_CATEGORIES.map((c, i) => ({ id: String(i), name: c.name, type: c.type, keywords: c.keywords ?? [], subcategories: c.subcategories ?? [], emoji: c.emoji, color: c.color }));

describe("receipt parsing", () => {
  it("finds merchant, total, date and category", () => {
    const text = `KOLACHI RESTAURANT\nDo Darya, Karachi\n23/10/2026 13:42\nChicken karahi 1,450\nNaan x4 240\nRaita 180\nSoft drinks x2 360\nSub Total 2,230\nTax 220\nTOTAL 2,450\nCash 3,000\nChange 550`;
    const r = parseReceipt(text, cats);
    expect(r.total).toBe(245000);
    expect(r.merchant).toBe("Kolachi Restaurant");
    expect(r.category?.name).toBe("Food");
    expect(r.date?.getDate()).toBe(23);
  });
  it("falls back to the largest amount", () => {
    const r = parseReceipt("Imtiaz Super Market\nMilk 320\nBread 180\nEggs 450\n950", cats);
    expect(r.total).toBe(95000);
    expect(r.category?.name).toBe("Groceries");
  });
});
