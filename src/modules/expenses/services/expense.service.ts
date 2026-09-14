import { eventBus } from "@shared/events/event-bus";
import type { Expense } from "../types/expense.types";
import type { IExpenseRepository } from "../repositories/expense.repository";
import type { CreateExpenseInput, UpdateExpenseInput } from "../types/expense.types";
import { expenseCreated, expenseUpdated, expenseDeleted } from "../events/expense.events";

/**
 * Business rules for expenses, on top of the repository's plain CRUD.
 * Mirrors what `expense-dialog.tsx`'s mutation function used to do inline:
 * resolve category vs. a freshly-typed new category, save the new category
 * if any, then write the expense.
 */
export class ExpenseService {
  constructor(
    private readonly repository: IExpenseRepository,
    private readonly tenantId: string,
    private readonly userId: string,
  ) {}

  list(): Promise<Expense[]> {
    return this.repository.list();
  }

  listCategories(): Promise<string[]> {
    return this.repository.listCategories().then((rows) => rows.map((r) => r.name));
  }

  async create(input: CreateExpenseInput): Promise<Expense> {
    const category = await this.resolveCategory(input);
    const expense = await this.repository.create({
      title: input.title || null,
      category,
      amount: input.amount,
      expense_date: input.expense_date,
      payment_method: input.payment_method,
      description: input.description,
      vendor_name: input.vendor_name,
      vendor_phone: input.vendor_phone,
      vendor_email: input.vendor_email,
      status: input.status,
      recurrence: input.recurrence,
      receipt_url: input.receipt_url,
      tenant_id: this.tenantId,
      created_by: this.userId,
    });
    await eventBus.publish(expenseCreated(this.tenantId, expense));
    return expense;
  }

  async update(input: UpdateExpenseInput): Promise<Expense> {
    const category = await this.resolveCategory(input);
    const expense = await this.repository.update(input.id, {
      title: input.title || null,
      category,
      amount: input.amount,
      expense_date: input.expense_date,
      payment_method: input.payment_method,
      description: input.description,
      vendor_name: input.vendor_name,
      vendor_phone: input.vendor_phone,
      vendor_email: input.vendor_email,
      status: input.status,
      recurrence: input.recurrence,
      receipt_url: input.receipt_url,
    });
    await eventBus.publish(expenseUpdated(this.tenantId, expense));
    return expense;
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
    await eventBus.publish(expenseDeleted(this.tenantId, id));
  }

  private async resolveCategory(input: CreateExpenseInput): Promise<string> {
    const newCategory = input.newCategory?.trim();
    if (newCategory) {
      await this.repository.upsertCategory(this.tenantId, newCategory);
      return newCategory;
    }
    return input.category;
  }
}
