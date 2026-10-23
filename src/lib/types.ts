export type { PublicUser } from "./auth";
export type { AccountJSON } from "./finance";
export type { TxJSON, CategoryJSON } from "./serialize";

export type Summary = {
  user: import("./auth").PublicUser;
  total: number;
  accountNames: string[];
  month: { income: number; spent: number; start: string; end: string };
  week: { days: { date: string; total: number; future: boolean }[]; total: number; lastWeek: number };
  recent: import("./serialize").TxJSON[];
  unread: number;
  hasTransactions: boolean;
};

export type Insights = {
  range: { start: string; end: string; key: string; label: string };
  spent: number; prevSpent: number; income: number; dailyAverage: number;
  categories: { id: string | null; name: string; emoji: string; color: string; total: number; count: number }[];
  trend: { label: string; total: number; current: boolean }[];
  insight: { title: string; body: string; categoryId: string } | null;
};

export type BudgetRow = {
  id: string | null; period: string; amount: number; rollover?: boolean; alerts?: number[];
  category: { id: string; name: string; emoji: string; color: string } | null;
  spent: number; limit: number; end?: string; summed?: boolean;
};
export type GoalRow = { id: string; name: string; emoji: string; target: number; saved: number; targetDate: string | null };

export type RecurringItem = {
  id: string; type: "expense" | "income"; name: string; emoji: string; color: string; amount: number;
  account: { id: string; name: string }; category: { id: string; name: string } | null; subcategory: string | null;
  frequency: "daily" | "weekly" | "monthly" | "yearly"; interval: number; nextDate: string; mode: "auto" | "ask"; subscription: boolean; paused: boolean;
};

export type Template = {
  id: string; name: string; emoji: string; type: "expense" | "income"; amount: number;
  account: { id: string; name: string } | null; category: { id: string; name: string; emoji: string; color: string } | null;
};

export type PersonRow = { id: string; name: string; color: string; balance: number; open: number };
export type DebtRow = { id: string; amount: number; note: string; date: string; settled: boolean; person: { id: string; name: string }; transaction: { id: string; amount: number; note: string } | null };

export type NotificationRow = { id: string; kind: string; title: string; body: string; link: string | null; read: boolean; createdAt: string };
