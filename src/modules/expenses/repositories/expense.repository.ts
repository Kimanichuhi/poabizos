import { BaseRepository } from "@infrastructure/database/base-repository";
import type { Database } from "@/integrations/supabase/types";
import type { Expense, ExpenseCategory } from "../types/expense.types";

type ExpenseInsert = Database["public"]["Tables"]["expenses"]["Insert"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

/** What `ExpenseService` depends on — lets tests fake the repository without touching Supabase types. */
export interface IExpenseRepository {
  list(): Promise<Expense[]>;
  create(payload: ExpenseInsert): Promise<Expense>;
  update(id: string, payload: ExpenseUpdate): Promise<Expense>;
  delete(id: string): Promise<void>;
  listCategories(): Promise<ExpenseCategory[]>;
  upsertCategory(tenantId: string, name: string): Promise<void>;
}

/**
 * The only place allowed to call `.from("expenses" | "expense_categories")`.
 * All methods are tenant-scoped by RLS on the injected client — callers must
 * pass a client whose session belongs to the target tenant (or the
 * service-role client for platform-admin paths, none of which exist yet for
 * expenses).
 */
export class ExpenseRepository extends BaseRepository implements IExpenseRepository {
  async list(): Promise<Expense[]> {
    const { data, error } = await this.client
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(500);
    if (error) this.raise(error, "Failed to list expenses");
    return data ?? [];
  }

  async create(payload: ExpenseInsert): Promise<Expense> {
    const { data, error } = await this.client.from("expenses").insert(payload).select().single();
    if (error) this.raise(error, "Failed to create expense");
    return data;
  }

  async update(id: string, payload: ExpenseUpdate): Promise<Expense> {
    const { data, error } = await this.client
      .from("expenses")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) this.raise(error, "Failed to update expense");
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from("expenses").delete().eq("id", id);
    if (error) this.raise(error, "Failed to delete expense");
  }

  async listCategories(): Promise<ExpenseCategory[]> {
    const { data, error } = await this.client.from("expense_categories").select("*").order("name");
    if (error) this.raise(error, "Failed to list expense categories");
    return data ?? [];
  }

  async upsertCategory(tenantId: string, name: string): Promise<void> {
    const { error } = await this.client
      .from("expense_categories")
      .upsert({ tenant_id: tenantId, name }, { onConflict: "tenant_id,name" });
    if (error) this.raise(error, "Failed to save expense category");
  }
}
