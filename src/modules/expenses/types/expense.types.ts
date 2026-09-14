import type { Database } from "@/integrations/supabase/types";

export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseCategory = Database["public"]["Tables"]["expense_categories"]["Row"];

export interface CreateExpenseInput {
  title: string;
  category: string;
  newCategory?: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  description: string;
  vendor_name: string;
  vendor_phone: string;
  vendor_email: string;
  status: string;
  recurrence: string;
  receipt_url: string;
}

export type UpdateExpenseInput = CreateExpenseInput & { id: string };
