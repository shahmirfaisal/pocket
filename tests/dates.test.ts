import { describe, expect, it } from "vitest";
import { advance, dayKey, monthRange, startOfDay, weekRange, zoned } from "@/lib/dates";

const tz = "Asia/Karachi";
describe("dates", () => {
  it("builds wall-clock instants in a timezone", () => {
    expect(zoned(2026, 10, 23, tz).toISOString()).toBe("2026-10-22T19:00:00.000Z");
    expect(dayKey(new Date("2026-10-22T19:30:00Z"), tz)).toBe("2026-10-23");
    expect(startOfDay(new Date("2026-10-23T10:00:00Z"), tz).toISOString()).toBe("2026-10-22T19:00:00.000Z");
  });
  it("handles budget months that start mid-month", () => {
    const r = monthRange(new Date("2026-10-23T10:00:00Z"), tz, 25);
    expect(dayKey(r.start, tz)).toBe("2026-09-25");
    expect(dayKey(r.end, tz)).toBe("2026-10-25");
    const jan = monthRange(new Date("2026-01-10T10:00:00Z"), tz, 1, -1);
    expect(dayKey(jan.start, tz)).toBe("2025-12-01");
  });
  it("starts weeks on Monday", () => {
    const w = weekRange(new Date("2026-10-23T10:00:00Z"), tz, 1); // Friday
    expect(dayKey(w.start, tz)).toBe("2026-10-19");
    expect(dayKey(w.end, tz)).toBe("2026-10-26");
  });
  it("keeps the 31st on monthly bills", () => {
    const jan31 = zoned(2026, 1, 31, tz, 9);
    const feb = advance(jan31, "monthly", 1, tz, 31);
    expect(dayKey(feb, tz)).toBe("2026-02-28");
    expect(dayKey(advance(feb, "monthly", 1, tz, 31), tz)).toBe("2026-03-31");
    expect(dayKey(advance(jan31, "yearly", 1, tz, 31), tz)).toBe("2027-01-31");
    expect(dayKey(advance(jan31, "weekly", 1, tz), tz)).toBe("2026-02-07");
  });
});
