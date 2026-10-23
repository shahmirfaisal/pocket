import "server-only";
import type { HydratedDocument } from "mongoose";
import { Recurring, type RecurringDoc, type UserDoc } from "@/models";
import { createTransaction } from "./transactions";
import { advance, partsIn } from "./dates";

/** Log one occurrence of a recurring item and move it to the next date. */
export async function runRecurring(user: UserDoc, r: HydratedDocument<RecurringDoc>) {
  const tz = user.timezone || "Asia/Karachi";
  const when = r.nextDate <= new Date() ? r.nextDate : new Date();
  const tx = await createTransaction(
    user,
    {
      type: r.type as "expense" | "income",
      amount: r.amount,
      account: String(r.account),
      category: r.category ? String(r.category) : null,
      subcategory: r.subcategory ?? null,
      note: r.name,
      tags: [],
      date: when,
      clientId: `rec-${r._id}-${r.nextDate.toISOString()}`,
    },
    { recurring: r._id }
  );
  r.nextDate = advance(r.nextDate, r.frequency as "monthly", r.interval || 1, tz, r.anchorDay ?? partsIn(r.nextDate, tz).d);
  r.remindedFor = undefined;
  await r.save();
  return tx;
}

export function monthlyEquivalent(r: { amount: number; frequency: string; interval?: number | null }) {
  const i = r.interval || 1;
  if (r.frequency === "daily") return (r.amount * 30) / i;
  if (r.frequency === "weekly") return (r.amount * 52) / 12 / i;
  if (r.frequency === "yearly") return r.amount / 12 / i;
  return r.amount / i;
}

