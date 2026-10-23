/** Pull the useful bits out of OCR'd receipt text. Runs in the browser. */
import type { QACategory } from "./quickadd";

const TOTAL_WORDS = /(grand\s*total|net\s*(total|amount|payable)|total\s*(amount|due|payable)?|amount\s*(due|payable)|payable|balance\s*due|to\s*pay)/i;
const SKIP_WORDS = /(sub\s*total|subtotal|tax|gst|vat|service|discount|change|cash\s*tendered|tendered|tip|qty|ntn|strn|tel|phone|invoice\s*no|bill\s*no)/i;

function numbersIn(line: string) {
  const out: number[] = [];
  for (const m of line.matchAll(/(\d{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?|\d+\.\d{1,2}|\d+)/g)) {
    const v = parseFloat(m[1].replace(/[,\s]/g, ""));
    if (!isNaN(v)) out.push(v);
  }
  return out;
}

export function parseReceipt(text: string, categories: QACategory[]) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Total: prefer "TOTAL"-like lines (the last one wins), else the biggest sensible number
  let total: number | null = null;
  for (const l of lines) {
    if (TOTAL_WORDS.test(l) && !/sub\s*total|subtotal/i.test(l)) {
      const n = numbersIn(l).filter((x) => x > 0 && x < 10_000_000);
      if (n.length) total = n[n.length - 1];
    }
  }
  if (total === null) {
    const all = lines.filter((l) => !SKIP_WORDS.test(l) && !/\d{1,2}[/:.-]\d{1,2}[/:.-]\d{2,4}/.test(l)).flatMap(numbersIn).filter((x) => x >= 10 && x < 1_000_000 && !Number.isInteger(x / 1e6));
    if (all.length) total = Math.max(...all);
  }

  // Merchant: first line that looks like a name
  const merchant = lines.slice(0, 6).find((l) => /[a-z]{3,}/i.test(l) && !/receipt|invoice|tax|welcome|tel|phone|www\.|http|ntn/i.test(l) && (l.match(/\d/g)?.length ?? 0) < 4) ?? null;

  // Date
  let date: Date | null = null;
  const dm = text.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (dm) {
    const y = dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3]);
    const d = new Date(y, Number(dm[2]) - 1, Number(dm[1]), 12);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now() + 86400000 && y > 2000) date = d;
  }
  const tm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (date && tm) date.setHours(Number(tm[1]), Number(tm[2]));

  // Category: keywords anywhere in the receipt
  const lower = text.toLowerCase();
  let category: QACategory | null = null;
  let best = 0;
  for (const c of categories.filter((x) => x.type === "expense")) {
    const hits = [c.name, ...c.keywords].filter((k) => k.length >= 3 && new RegExp(`\\b${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(lower)).length;
    if (hits > best) { best = hits; category = c; }
  }
  if (!category && /restaurant|cafe|karahi|biryani|naan|pizza|burger|tikka|chicken|roti/i.test(text)) category = categories.find((c) => c.name === "Food") ?? null;
  if (!category && /pharmacy|medic|tablet|syrup|clinic/i.test(text)) category = categories.find((c) => c.name === "Health") ?? null;
  if (!category && /petrol|fuel|diesel|pso|shell|total parco|attock/i.test(text)) category = categories.find((c) => c.name === "Transport") ?? null;

  return {
    total: total !== null ? Math.round(total * 100) : null,
    merchant: merchant ? niceCase(merchant.replace(/\s{2,}/g, " ").replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, "").slice(0, 60)) : null,
    date,
    category,
  };
}

/** Shrink a photo to a reasonable size before upload and OCR. */
export async function compressImage(file: Blob, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", quality));
}

/** Receipts print shop names in capitals: "KOLACHI RESTAURANT" → "Kolachi Restaurant". */
function niceCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/(^|[\s(&/-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase());
}
