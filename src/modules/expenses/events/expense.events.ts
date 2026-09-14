import type { DomainEvent } from "@shared/events/types";
import type { Expense } from "../types/expense.types";

export const EXPENSE_CREATED = "expense.created";
export const EXPENSE_UPDATED = "expense.updated";
export const EXPENSE_DELETED = "expense.deleted";

export type ExpenseCreated = DomainEvent<{ expense: Expense }>;
export type ExpenseUpdated = DomainEvent<{ expense: Expense }>;
export type ExpenseDeleted = DomainEvent<{ expenseId: string }>;

export function expenseCreated(tenantId: string, expense: Expense): ExpenseCreated {
  return {
    type: EXPENSE_CREATED,
    tenantId,
    payload: { expense },
    occurredAt: new Date().toISOString(),
  };
}

export function expenseUpdated(tenantId: string, expense: Expense): ExpenseUpdated {
  return {
    type: EXPENSE_UPDATED,
    tenantId,
    payload: { expense },
    occurredAt: new Date().toISOString(),
  };
}

export function expenseDeleted(tenantId: string, expenseId: string): ExpenseDeleted {
  return {
    type: EXPENSE_DELETED,
    tenantId,
    payload: { expenseId },
    occurredAt: new Date().toISOString(),
  };
}
