import { z } from "zod";
import { ACCOUNT_TYPES } from "@/models";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const minor = z.number().int().positive().max(1_000_000_000_000);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(60),
  email: z.email("Enter a valid email").transform((s) => s.toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email").transform((s) => s.toLowerCase()),
  password: z.string().min(1, "Enter your password"),
});

export const accountInput = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(ACCOUNT_TYPES),
  currency: z.string().length(3).default("PKR"),
  color: hex.default("#2F5BEA"),
  startingBalance: z.number().int().default(0),
  includeInTotal: z.boolean().default(true),
  creditDueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const txInput = z
  .object({
    type: z.enum(["expense", "income", "transfer"]),
    amount: minor,
    account: objectId,
    toAccount: objectId.optional().nullable(),
    category: objectId.optional().nullable(),
    subcategory: z.string().max(40).optional().nullable(),
    note: z.string().max(200).default(""),
    tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
    date: z.coerce.date(),
    receipt: z.string().regex(/^[\w-]+\.(jpg|jpeg|png|webp)$/).optional().nullable(),
    clientId: z.string().max(64).optional(),
    split: z
      .object({
        people: z.array(z.object({ person: objectId.optional(), name: z.string().trim().min(1).max(40).optional(), amount: minor })).min(1),
      })
      .optional()
      .nullable(),
    repeat: z.enum(["daily", "weekly", "monthly", "yearly"]).optional().nullable(),
  })
  .refine((t) => t.type !== "transfer" || (t.toAccount && t.toAccount !== t.account), { message: "Pick a different account to move money to", path: ["toAccount"] });

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(30),
  emoji: z.string().min(1).max(8),
  color: hex,
  type: z.enum(["expense", "income"]),
  subcategories: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  keywords: z.array(z.string().trim().toLowerCase().min(1).max(30)).max(40).default([]),
});

export const budgetInput = z.object({
  category: objectId.nullable().optional(),
  amount: minor,
  period: z.enum(["weekly", "monthly", "yearly"]),
  rollover: z.boolean().default(false),
  alerts: z.array(z.number().int().min(1).max(200)).max(5).default([80, 100]),
});

export const goalInput = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(8).default("🎯"),
  target: minor,
  targetDate: z.coerce.date().nullable().optional(),
  initial: z.number().int().min(0).default(0),
});

export const recurringInput = z.object({
  type: z.enum(["expense", "income"]),
  name: z.string().trim().min(1).max(40),
  emoji: z.string().min(1).max(8).default("🔁"),
  amount: minor,
  account: objectId,
  category: objectId.nullable().optional(),
  subcategory: z.string().max(40).nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).max(12).default(1),
  nextDate: z.coerce.date(),
  mode: z.enum(["auto", "ask"]).default("auto"),
  subscription: z.boolean().default(false),
  paused: z.boolean().default(false),
});

export const templateInput = z.object({
  name: z.string().trim().min(1).max(30),
  emoji: z.string().min(1).max(8).default("⚡"),
  type: z.enum(["expense", "income"]).default("expense"),
  amount: minor,
  account: objectId.nullable().optional(),
  category: objectId.nullable().optional(),
});

export const settingsInput = z.object({
  name: z.string().trim().min(1).max(60),
  currency: z.string().length(3),
  timezone: z.string().min(1).max(60),
  monthStartDay: z.number().int().min(1).max(28),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  defaultAccount: objectId.nullable(),
  theme: z.enum(["auto", "light", "dark"]),
  hideAmounts: z.boolean(),
  reminder: z.object({ enabled: z.boolean(), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  alerts: z.boolean(),
  lock: z.object({ enabled: z.boolean(), faceId: z.boolean(), autoLockSec: z.number().int().min(0).max(3600) }),
}).partial();
