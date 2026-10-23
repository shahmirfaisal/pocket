import { describe, expect, it } from "vitest";
import { formatMoney, toMinor } from "@/lib/money";

describe("money", () => {
  it("parses amounts into paisa", () => {
    expect(toMinor("1,250")).toBe(125000);
    expect(toMinor("850.5")).toBe(85050);
    expect(toMinor("1.2k")).toBe(120000);
    expect(toMinor("Rs 300")).toBe(30000);
    expect(toMinor("abc")).toBeNaN();
  });
  it("formats like the design", () => {
    expect(formatMoney(24835000)).toBe("Rs 248,350");
    expect(formatMoney(-125000)).toBe("−Rs 1,250");
    expect(formatMoney(18500000, "PKR", { sign: true })).toBe("+Rs 185,000");
    expect(formatMoney(8505)).toBe("Rs 85.05");
    expect(formatMoney(16000000, "PKR", { compact: true })).toBe("Rs 160k");
  });
});
