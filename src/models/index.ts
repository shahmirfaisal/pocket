import mongoose, { Schema, type InferSchemaType, Types } from "mongoose";

const { ObjectId } = Schema.Types;

// Next.js may evaluate this file more than once (pages and API routes are bundled
// separately). Reuse a model that's already registered: deleting and re-creating it
// would orphan the other copy's collection, whose queries then hang ("buffering timed out").
// In dev, restart the server after changing a schema.
function reuse<M>(name: string, make: () => M): M {
  return (mongoose.models[name] as M | undefined) ?? make();
}

/* ---------- Users & auth ---------- */

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    currency: { type: String, default: "PKR" },
    timezone: { type: String, default: "Asia/Karachi" },
    monthStartDay: { type: Number, default: 1, min: 1, max: 28 },
    weekStartsOn: { type: Number, default: 1 }, // 0 = Sunday, 1 = Monday
    defaultAccount: { type: ObjectId, ref: "Account" },
    theme: { type: String, enum: ["auto", "light", "dark"], default: "auto" },
    hideAmounts: { type: Boolean, default: false },
    reminder: {
      enabled: { type: Boolean, default: true },
      time: { type: String, default: "21:00" },
    },
    alerts: { type: Boolean, default: true },
    lock: {
      enabled: { type: Boolean, default: false },
      faceId: { type: Boolean, default: false },
      pinHash: { type: String },
      autoLockSec: { type: Number, default: 60 },
    },
    setupStep: { type: Number, default: 0 }, // 0 = not onboarded, 3 = done
  },
  { timestamps: true }
);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export const User = reuse("User", () => mongoose.model("User", userSchema));

const passkeySchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, default: 0 },
    transports: [String],
    deviceName: String,
  },
  { timestamps: true }
);
export const Passkey = reuse("Passkey", () => mongoose.model("Passkey", passkeySchema));

/* ---------- Money ---------- */

export const ACCOUNT_TYPES = ["cash", "bank", "savings", "credit", "wallet", "investment", "loan", "other"] as const;

const memberSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User" },
    email: { type: String, lowercase: true, trim: true, required: true },
    name: String,
    role: { type: String, enum: ["editor", "viewer"], default: "editor" },
    status: { type: String, enum: ["pending", "active"], default: "pending" },
  },
  { _id: true }
);

const accountSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ACCOUNT_TYPES, default: "bank" },
    currency: { type: String, default: "PKR" },
    color: { type: String, default: "#2F5BEA" },
    startingBalance: { type: Number, default: 0 },
    includeInTotal: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    creditDueDay: Number,
    members: [memberSchema],
  },
  { timestamps: true }
);
accountSchema.index({ "members.user": 1 });
accountSchema.index({ "members.email": 1 });
export type AccountDoc = InferSchemaType<typeof accountSchema> & { _id: Types.ObjectId };
export const Account = reuse("Account", () => mongoose.model("Account", accountSchema));

const categorySchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: "🏷️" },
    color: { type: String, default: "#F1F2F4" },
    type: { type: String, enum: ["expense", "income"], default: "expense" },
    subcategories: [String],
    keywords: [String],
    order: { type: Number, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: Types.ObjectId };
export const Category = reuse("Category", () => mongoose.model("Category", categorySchema));

const transactionSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true }, // creator
    account: { type: ObjectId, ref: "Account", required: true, index: true },
    toAccount: { type: ObjectId, ref: "Account", index: true },
    type: { type: String, enum: ["expense", "income", "transfer"], required: true },
    amount: { type: Number, required: true, min: 1 },
    category: { type: ObjectId, ref: "Category" },
    subcategory: String,
    note: { type: String, trim: true, default: "" },
    tags: [String],
    date: { type: Date, required: true, index: true },
    receipt: String,
    recurring: { type: ObjectId, ref: "Recurring" },
    clientId: { type: String, index: true, sparse: true }, // offline de-duplication
  },
  { timestamps: true }
);
transactionSchema.index({ account: 1, date: -1 });
transactionSchema.index({ note: "text", tags: "text" });
export type TransactionDoc = InferSchemaType<typeof transactionSchema> & { _id: Types.ObjectId };
export const Transaction = reuse("Transaction", () => mongoose.model("Transaction", transactionSchema));

const budgetSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    category: { type: ObjectId, ref: "Category" }, // empty = overall budget
    amount: { type: Number, required: true, min: 1 },
    period: { type: String, enum: ["weekly", "monthly", "yearly"], default: "monthly" },
    rollover: { type: Boolean, default: false },
    alerts: { type: [Number], default: [80, 100] },
    alertState: { periodKey: String, sent: [Number] },
  },
  { timestamps: true }
);
export type BudgetDoc = InferSchemaType<typeof budgetSchema> & { _id: Types.ObjectId };
export const Budget = reuse("Budget", () => mongoose.model("Budget", budgetSchema));

const goalSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: "🎯" },
    target: { type: Number, required: true, min: 1 },
    targetDate: Date,
    archived: { type: Boolean, default: false },
    contributions: [
      {
        amount: { type: Number, required: true }, // negative = withdrawal
        date: { type: Date, default: Date.now },
        note: String,
        account: { type: ObjectId, ref: "Account" },
      },
    ],
  },
  { timestamps: true }
);
export type GoalDoc = InferSchemaType<typeof goalSchema> & { _id: Types.ObjectId };
export const Goal = reuse("Goal", () => mongoose.model("Goal", goalSchema));

const recurringSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["expense", "income"], default: "expense" },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: "🔁" },
    amount: { type: Number, required: true, min: 1 },
    account: { type: ObjectId, ref: "Account", required: true },
    category: { type: ObjectId, ref: "Category" },
    subcategory: String,
    frequency: { type: String, enum: ["daily", "weekly", "monthly", "yearly"], default: "monthly" },
    interval: { type: Number, default: 1, min: 1 },
    nextDate: { type: Date, required: true, index: true },
    anchorDay: Number, // day of month bills fall on (so 31st stays 31st after February)
    mode: { type: String, enum: ["auto", "ask"], default: "auto" },
    subscription: { type: Boolean, default: false },
    paused: { type: Boolean, default: false },
    remindedFor: Date,
  },
  { timestamps: true }
);
export type RecurringDoc = InferSchemaType<typeof recurringSchema> & { _id: Types.ObjectId };
export const Recurring = reuse("Recurring", () => mongoose.model("Recurring", recurringSchema));

const templateSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    emoji: { type: String, default: "⚡" },
    type: { type: String, enum: ["expense", "income"], default: "expense" },
    amount: { type: Number, required: true, min: 1 },
    account: { type: ObjectId, ref: "Account" },
    category: { type: ObjectId, ref: "Category" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const Template = reuse("Template", () => mongoose.model("Template", templateSchema));

/* ---------- Splitting ---------- */

const personSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#E9F0FF" },
  },
  { timestamps: true }
);
export const Person = reuse("Person", () => mongoose.model("Person", personSchema));

const debtSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    person: { type: ObjectId, ref: "Person", required: true, index: true },
    amount: { type: Number, required: true }, // > 0 they owe you, < 0 you owe them
    note: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    transaction: { type: ObjectId, ref: "Transaction", index: true },
    settled: { type: Boolean, default: false },
    settledAt: Date,
  },
  { timestamps: true }
);
export const Debt = reuse("Debt", () => mongoose.model("Debt", debtSchema));

/* ---------- Notifications ---------- */

const notificationSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, default: "info" }, // budget, recurring, shared, split, goal, reminder, info
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = reuse("Notification", () => mongoose.model("Notification", notificationSchema));

const pushSubSchema = new Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
  },
  { timestamps: true }
);
export const PushSub = reuse("PushSub", () => mongoose.model("PushSub", pushSubSchema));
