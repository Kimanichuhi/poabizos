import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import {
  createExpense,
  deleteExpense,
  listExpenseCategories,
  listExpenses,
  updateExpense,
} from "../api/expense.functions";
import type { CreateExpenseInput, UpdateExpenseInput } from "../types/expense.types";

const EXPENSES_KEY = ["resource", "expenses"] as const;
const EXPENSE_CATEGORIES_KEY = ["expense-categories"] as const;

export function useExpenses() {
  const { tenant, isPlatformAdmin } = useAuth();
  const listFn = useServerFn(listExpenses);
  const queryKey = [...EXPENSES_KEY, tenant?.id];
  return useQuery({
    queryKey,
    enabled: !!tenant?.id || isPlatformAdmin,
    queryFn: async () => (await listFn()).expenses,
  });
}

export function useExpenseCategories(enabled: boolean) {
  const { tenant } = useAuth();
  const listCategoriesFn = useServerFn(listExpenseCategories);
  return useQuery({
    queryKey: [...EXPENSE_CATEGORIES_KEY, tenant?.id],
    enabled: !!tenant?.id && enabled,
    queryFn: async () => (await listCategoriesFn()).categories,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const createFn = useServerFn(createExpense);
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY });
      qc.invalidateQueries({ queryKey: EXPENSE_CATEGORIES_KEY });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateExpense);
  return useMutation({
    mutationFn: (input: UpdateExpenseInput) => updateFn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSES_KEY });
      qc.invalidateQueries({ queryKey: EXPENSE_CATEGORIES_KEY });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  const deleteFn = useServerFn(deleteExpense);
  return useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_KEY }),
  });
}
