import { z } from "zod";

/**
 * Mirrors the fields/requirements the original `expense-dialog.tsx` enforced:
 * either `category` or `newCategory` must be present, `amount` and
 * `expense_date` are required, everything else is optional/defaulted.
 */
const baseExpenseFields = {
  title: z.string().default(""),
  category: z.string().default(""),
  newCategory: z.string().optional(),
  amount: z.coerce.number().min(0, "Amount must be zero or greater"),
  expense_date: z.string().min(1, "Date is required"),
  payment_method: z.string().default("cash"),
  description: z.string().default(""),
  vendor_name: z.string().default(""),
  vendor_phone: z.string().default(""),
  vendor_email: z.string().default(""),
  status: z.string().default("paid"),
  recurrence: z.string().default("none"),
  receipt_url: z.string().default(""),
};

function requireCategory<T extends { category: string; newCategory?: string }>(
  data: T,
  ctx: z.RefinementCtx,
) {
  if (!data.category.trim() && !data.newCategory?.trim()) {
    ctx.addIssue({ code: "custom", message: "Category is required", path: ["category"] });
  }
}

export const createExpenseSchema = z.object(baseExpenseFields).superRefine(requireCategory);

export const updateExpenseSchema = z
  .object({ id: z.string().min(1), ...baseExpenseFields })
  .superRefine(requireCategory);
