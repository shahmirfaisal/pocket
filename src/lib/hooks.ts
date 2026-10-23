"use client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AccountJSON, BudgetRow, CategoryJSON, DebtRow, GoalRow, Insights, NotificationRow, PersonRow, RecurringItem, Summary, Template, TxJSON,
} from "./types";

export const useSummary = () => useQuery({ queryKey: ["summary"], queryFn: () => api<Summary>("/api/summary") });

export const useAccounts = (archived = false) =>
  useQuery({
    queryKey: ["accounts", archived],
    queryFn: () => api<{ accounts: AccountJSON[]; netWorth: number; invites: { id: string; name: string; from: string }[] }>(`/api/accounts${archived ? "?archived=1" : ""}`),
  });

export const useAccount = (id: string) =>
  useQuery({
    queryKey: ["account", id],
    enabled: !!id,
    queryFn: () => api<{ account: AccountJSON; owner: { id: string; name: string; email: string }; series: number[]; month: { in: number; out: number }; members: { user: string; name: string; spent: number }[] }>(`/api/accounts/${id}`),
  });

export const useCategories = () =>
  useQuery({ queryKey: ["categories"], queryFn: () => api<{ categories: CategoryJSON[] }>("/api/categories"), staleTime: 5 * 60_000 });

export type TxFilters = { type?: string; category?: string[]; account?: string[]; from?: string; to?: string; q?: string; min?: number; max?: number; subcategory?: string; limit?: number };

export function filtersToQuery(f: TxFilters) {
  const sp = new URLSearchParams();
  if (f.type) sp.set("type", f.type);
  if (f.category?.length) sp.set("category", f.category.join(","));
  if (f.account?.length) sp.set("account", f.account.join(","));
  if (f.from) sp.set("from", f.from);
  if (f.to) sp.set("to", f.to);
  if (f.q) sp.set("q", f.q);
  if (f.min) sp.set("min", String(f.min));
  if (f.max) sp.set("max", String(f.max));
  if (f.subcategory) sp.set("subcategory", f.subcategory);
  if (f.limit) sp.set("limit", String(f.limit));
  return sp.toString();
}

export const useTransactions = (f: TxFilters, enabled = true) =>
  useInfiniteQuery({
    queryKey: ["transactions", f],
    enabled,
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const qs = filtersToQuery(f);
      return api<{ transactions: TxJSON[]; next: string | null; totals?: { expense: number; income: number; count: number } }>(
        `/api/transactions?${qs}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`
      );
    },
    getNextPageParam: (last) => last.next ?? undefined,
  });

export const useTransaction = (id: string) =>
  useQuery({
    queryKey: ["transaction", id],
    enabled: !!id,
    queryFn: () => api<{ transaction: TxJSON; splits: { id: string; person: { id: string; name: string }; amount: number; settled: boolean }[] }>(`/api/transactions/${id}`),
  });

export const useInsights = (period: string, offset: number) =>
  useQuery({ queryKey: ["insights", period, offset], queryFn: () => api<Insights>(`/api/insights?period=${period}&offset=${offset}`) });

export const useCalendar = (month: string) =>
  useQuery({ queryKey: ["calendar", month], queryFn: () => api<{ year: number; month: number; firstWeekday: number; days: Record<string, { spent: number; income: number }>; today: string }>(`/api/calendar?month=${month}`) });

export const useBudgets = () =>
  useQuery({ queryKey: ["budgets"], queryFn: () => api<{ overall: BudgetRow | null; budgets: BudgetRow[]; daysLeft: number; goals: GoalRow[] }>("/api/budgets") });

export const useGoal = (id: string) =>
  useQuery({
    queryKey: ["goal", id],
    enabled: !!id,
    queryFn: () => api<{ goal: { id: string; name: string; emoji: string; target: number; targetDate: string | null; saved: number; left: number; perMonth: number | null; onTrack: boolean | null; contributions: { id: string; amount: number; date: string; note: string; account: string | null }[] } }>(`/api/goals/${id}`),
  });

export const useRecurring = () =>
  useQuery({ queryKey: ["recurring"], queryFn: () => api<{ bills: number; income: number; items: RecurringItem[] }>("/api/recurring") });

export const useTemplates = () => useQuery({ queryKey: ["templates"], queryFn: () => api<{ templates: Template[] }>("/api/templates") });

export const usePeople = () =>
  useQuery({ queryKey: ["people"], queryFn: () => api<{ owed: number; owe: number; people: PersonRow[]; recent: DebtRow[] }>("/api/people") });

export const useNotifications = () =>
  useQuery({ queryKey: ["notifications"], queryFn: () => api<{ notifications: NotificationRow[] }>("/api/notifications") });

export const useReportsInfo = () =>
  useQuery({ queryKey: ["reports"], queryFn: () => api<{ count: number; lastBackup: string | null; lastMonth: { label: string; from: string; to: string } }>("/api/reports") });

/** A mutation that refreshes everything afterwards — simplest way to keep every screen consistent. */
export function useAction<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, opts: { onSuccess?: (r: TRes, v: TVars) => void; onError?: (e: Error) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, v) => {
      await qc.invalidateQueries();
      opts.onSuccess?.(r, v);
    },
    onError: opts.onError,
  });
}
