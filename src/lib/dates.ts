/** Timezone-aware date helpers. All stored dates are UTC instants. */

type Parts = { y: number; m: number; d: number; h: number; min: number; wd: number };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric", weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function partsIn(date: Date, tz: string): Parts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, wd: WD[p.weekday] };
}

function offsetMs(date: Date, tz: string) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, date.getUTCSeconds());
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant of a wall-clock time in tz. Month is 1-based; values may overflow (Date.UTC normalises). */
export function zoned(y: number, m: number, d: number, tz: string, h = 0, min = 0) {
  const guess = new Date(Date.UTC(y, m - 1, d, h, min));
  const off = offsetMs(guess, tz);
  const first = new Date(guess.getTime() - off);
  const off2 = offsetMs(first, tz);
  return off2 === off ? first : new Date(guess.getTime() - off2);
}

export function startOfDay(date: Date, tz: string) {
  const p = partsIn(date, tz);
  return zoned(p.y, p.m, p.d, tz);
}

export function addDays(date: Date, n: number, tz: string) {
  const p = partsIn(date, tz);
  return zoned(p.y, p.m, p.d + n, tz, p.h, p.min);
}

export function dayKey(date: Date, tz: string) {
  const p = partsIn(date, tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export type Range = { start: Date; end: Date; key: string };

/** Budget month that starts on `startDay`. */
export function monthRange(date: Date, tz: string, startDay = 1, offset = 0): Range {
  const p = partsIn(date, tz);
  let y = p.y, m = p.m;
  if (p.d < startDay) m -= 1;
  m += offset;
  const start = zoned(y, m, startDay, tz);
  const end = zoned(y, m + 1, startDay, tz);
  const sp = partsIn(start, tz);
  return { start, end, key: `m-${sp.y}-${sp.m}` };
}

export function weekRange(date: Date, tz: string, weekStartsOn = 1, offset = 0): Range {
  const p = partsIn(date, tz);
  const back = (p.wd - weekStartsOn + 7) % 7;
  const start = zoned(p.y, p.m, p.d - back + offset * 7, tz);
  const end = zoned(p.y, p.m, p.d - back + offset * 7 + 7, tz);
  return { start, end, key: `w-${dayKey(start, tz)}` };
}

export function yearRange(date: Date, tz: string, offset = 0): Range {
  const p = partsIn(date, tz);
  return { start: zoned(p.y + offset, 1, 1, tz), end: zoned(p.y + offset + 1, 1, 1, tz), key: `y-${p.y + offset}` };
}

export function periodRange(period: "weekly" | "monthly" | "yearly", date: Date, tz: string, startDay = 1, weekStartsOn = 1, offset = 0) {
  if (period === "weekly") return weekRange(date, tz, weekStartsOn, offset);
  if (period === "yearly") return yearRange(date, tz, offset);
  return monthRange(date, tz, startDay, offset);
}

/** Advance a recurring date by one interval, keeping the wall-clock time in tz. */
export function advance(date: Date, frequency: "daily" | "weekly" | "monthly" | "yearly", interval: number, tz: string, anchorDay?: number) {
  const p = partsIn(date, tz);
  if (frequency === "daily") return zoned(p.y, p.m, p.d + interval, tz, p.h, p.min);
  if (frequency === "weekly") return zoned(p.y, p.m, p.d + 7 * interval, tz, p.h, p.min);
  const day = anchorDay ?? p.d;
  const y = frequency === "yearly" ? p.y + interval : p.y;
  const m = frequency === "monthly" ? p.m + interval : p.m;
  // Clamp to the last day of the target month (31 Jan -> 28 Feb)
  const last = partsIn(zoned(y, m + 1, 0, tz, 12), tz).d;
  return zoned(y, m, Math.min(day, last), tz, p.h, p.min);
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
