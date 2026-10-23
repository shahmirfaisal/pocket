/** Amounts are stored as integer minor units (paisa for PKR). */

export const CURRENCIES: Record<string, { symbol: string; name: string }> = {
  PKR: { symbol: "Rs", name: "Pakistani rupee" },
  USD: { symbol: "$", name: "US dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British pound" },
  AED: { symbol: "AED", name: "UAE dirham" },
  SAR: { symbol: "SAR", name: "Saudi riyal" },
  INR: { symbol: "₹", name: "Indian rupee" },
  AZN: { symbol: "₼", name: "Azerbaijani manat" },
};

export function symbolFor(currency = "PKR") {
  return CURRENCIES[currency]?.symbol ?? currency;
}

/** Parse "1,250.50" / "1.2k" into minor units. Returns NaN when invalid. */
export function toMinor(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  let s = input.trim().toLowerCase().replace(/,/g, "").replace(/^rs\.?\s*/, "");
  let mult = 1;
  if (s.endsWith("k")) { mult = 1000; s = s.slice(0, -1); }
  else if (s.endsWith("m")) { mult = 1_000_000; s = s.slice(0, -1); }
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  return Math.round(parseFloat(s) * mult * 100);
}

export function fromMinor(minor: number) {
  return minor / 100;
}

export function formatMoney(minor: number, currency = "PKR", opts: { sign?: boolean; compact?: boolean } = {}) {
  const value = Math.abs(minor) / 100;
  const hasFraction = Math.round(value * 100) % 100 !== 0;
  let body: string;
  if (opts.compact && value >= 1000) {
    body = value >= 1_000_000 ? `${trim(value / 1_000_000)}M` : `${trim(value / 1000)}k`;
  } else {
    body = value.toLocaleString("en-US", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 });
  }
  const sym = symbolFor(currency);
  const sign = minor < 0 ? "−" : opts.sign && minor > 0 ? "+" : "";
  return `${sign}${sym} ${body}`.replace(/^([−+])(\S+) /, "$1$2 ");
}

function trim(n: number) {
  return n >= 100 ? Math.round(n).toString() : n.toFixed(1).replace(/\.0$/, "");
}
