/** Natural-language quick add: "lunch 850 jazzcash yesterday #work". Runs in the browser. */
import { addDays, partsIn, startOfDay, zoned } from "./dates";
import { toMinor } from "./money";

export type QAAccount = { id: string; name: string; type?: string };
export type QACategory = { id: string; name: string; type: "expense" | "income"; keywords: string[]; subcategories: string[]; emoji: string; color: string };

export type QAResult = {
  type: "expense" | "income";
  amount: number | null;
  account: QAAccount | null;
  category: QACategory | null;
  subcategory: string | null;
  date: Date;
  dateLabel: string;
  note: string;
  tags: string[];
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const INCOME_WORDS = ["received", "got", "income", "earned", "salary", "refund", "cashback"];
const FILLER = new Set(["on", "for", "at", "from", "via", "with", "in", "by", "paid", "spent", "rs", "pkr", "the", "a", "an"]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, "");

export function parseQuickAdd(text: string, accounts: QAAccount[], categories: QACategory[], tz: string, now = new Date()): QAResult {
  let tokens = text.trim().split(/\s+/).filter(Boolean);
  const used = new Set<number>();
  let amount: number | null = null;
  let type: "expense" | "income" = "expense";
  const tags: string[] = [];
  let date = now;
  let dateLabel = "Today";

  tokens.forEach((t, i) => {
    if (t.startsWith("#") && t.length > 1) { tags.push(t.slice(1).toLowerCase()); used.add(i); }
  });

  // Amount: first number-looking token
  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    let t = tokens[i].toLowerCase();
    if (t.startsWith("+")) { type = "income"; t = t.slice(1); }
    const v = toMinor(t);
    if (!isNaN(v) && v > 0 && /\d/.test(t) && !/^\d{1,2}[/-]\d{1,2}/.test(t)) { amount = v; used.add(i); break; }
  }

  // Dates
  const lower = tokens.map((t) => t.toLowerCase());
  for (let i = 0; i < lower.length; i++) {
    if (used.has(i)) continue;
    const t = lower[i];
    if (t === "today") { used.add(i); }
    else if (t === "yesterday" || t === "kal") { date = addDays(now, -1, tz); dateLabel = "Yesterday"; used.add(i); }
    else if (DAY_NAMES.includes(t) || DAY_NAMES.some((d) => d.slice(0, 3) === t)) {
      const target = DAY_NAMES.findIndex((d) => d === t || d.slice(0, 3) === t);
      const back = ((partsIn(now, tz).wd - target + 7) % 7) || 7;
      date = addDays(now, -back, tz);
      dateLabel = DAY_NAMES[target][0].toUpperCase() + DAY_NAMES[target].slice(1, 3);
      used.add(i);
      if (lower[i - 1] === "last" || lower[i - 1] === "on") used.add(i - 1);
    } else if (/^\d+$/.test(t) && lower[i + 1]?.startsWith("day") && lower[i + 2] === "ago") {
      date = addDays(now, -Number(t), tz); dateLabel = `${t} days ago`; used.add(i); used.add(i + 1); used.add(i + 2);
    } else {
      const m = t.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
      if (m) {
        const p = partsIn(now, tz);
        const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : p.y;
        date = zoned(y, Number(m[2]), Number(m[1]), tz, p.h, p.min);
        dateLabel = `${m[1]}/${m[2]}`;
        used.add(i);
      }
    }
  }
  if (date !== now) {
    // Keep the time of day for past dates at noon so they sort sensibly
    const s = startOfDay(date, tz);
    date = new Date(s.getTime() + 12 * 3600 * 1000);
  }

  // Account: longest name match (supports multi-word names and prefixes like "jazz" → JazzCash)
  let account: QAAccount | null = null;
  for (let i = 0; i < tokens.length && !account; i++) {
    if (used.has(i)) continue;
    const t = norm(tokens[i]);
    if (t.length < 3) continue;
    for (const a of accounts) {
      const n = norm(a.name);
      const two = i + 1 < tokens.length ? norm(tokens[i] + tokens[i + 1]) : "";
      if (two && n === two) { account = a; used.add(i); used.add(i + 1); break; }
      if (n === t || (t.length >= 4 && n.startsWith(t)) || (a.type === "cash" && t === "cash")) { account = a; used.add(i); break; }
    }
  }

  if (lower.some((t, i) => !used.has(i) && INCOME_WORDS.includes(t))) type = "income";

  // Category: subcategory name, category name, then keywords
  let category: QACategory | null = null;
  let subcategory: string | null = null;
  const pool = categories.filter((c) => c.type === type).concat(categories.filter((c) => c.type !== type));
  outer: for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    const t = norm(tokens[i]);
    if (t.length < 2) continue;
    for (const c of pool) {
      const sub = c.subcategories.find((s) => norm(s) === t);
      if (sub) { category = c; subcategory = sub; break outer; }
      if (norm(c.name) === t || c.keywords.some((k) => norm(k) === t || (t.length >= 4 && norm(k) === t.replace(/s$/, "")))) { category = c; break outer; }
    }
  }
  if (category && category.type !== type) type = category.type;

  const noteWords = tokens.filter((t, i) => !used.has(i) && !FILLER.has(t.toLowerCase()));
  let note = noteWords.join(" ");
  if (note) note = note[0].toUpperCase() + note.slice(1);

  tokens = [];
  return { type, amount, account, category, subcategory, date, dateLabel, note, tags };
}
