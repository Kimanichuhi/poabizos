import { describe, expect, it, vi } from "vitest";
import { ExpenseService } from "../services/expense.service";
import type { IExpenseRepository } from "../repositories/expense.repository";
import { eventBus } from "@shared/events/event-bus";
import { EXPENSE_CREATED, EXPENSE_DELETED, EXPENSE_UPDATED } from "../events/expense.events";
import type { CreateExpenseInput, Expense, ExpenseCategory } from "../types/expense.types";
import type { DomainEvent } from "@shared/events/types";

function baseInput(overrides: Partial<CreateExpenseInput> = {}): CreateExpenseInput {
  return {
    title: "Electricity",
    category: "Utilities",
    amount: 500,
    expense_date: "2026-07-01",
    payment_method: "cash",
    description: "",
    vendor_name: "",
    vendor_phone: "",
    vendor_email: "",
    status: "paid",
    recurrence: "none",
    receipt_url: "",
    ...overrides,
  };
}

function fakeRepository(): IExpenseRepository {
  return {
    create: vi.fn(async (payload) => ({ id: "e1", ...payload }) as Expense),
    update: vi.fn(async (_id, payload) => ({ id: "e1", ...payload }) as Expense),
    delete: vi.fn(async () => undefined),
    upsertCategory: vi.fn(async () => undefined),
    list: vi.fn(async () => [] as Expense[]),
    listCategories: vi.fn(async () => [] as ExpenseCategory[]),
  };
}

describe("ExpenseService", () => {
  it("uses the selected category as-is when no new category is typed", async () => {
    const repo = fakeRepository();
    const service = new ExpenseService(repo, "tenant-1", "user-1");
    const expense = await service.create(baseInput());
    expect(repo.upsertCategory).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "Utilities",
        tenant_id: "tenant-1",
        created_by: "user-1",
      }),
    );
    expect(expense.category).toBe("Utilities");
  });

  it("saves and uses a freshly typed category when newCategory is provided", async () => {
    const repo = fakeRepository();
    const service = new ExpenseService(repo, "tenant-1", "user-1");
    await service.create(baseInput({ category: "", newCategory: "  Custom Cat  " }));
    expect(repo.upsertCategory).toHaveBeenCalledWith("tenant-1", "Custom Cat");
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ category: "Custom Cat" }));
  });

  it("publishes ExpenseCreated after a successful create", async () => {
    const repo = fakeRepository();
    const service = new ExpenseService(repo, "tenant-1", "user-1");
    const seen: DomainEvent<{ expense: Expense }>[] = [];
    const unsubscribe = eventBus.subscribe<{ expense: Expense }>(EXPENSE_CREATED, (e) => {
      seen.push(e);
    });
    try {
      await service.create(baseInput());
      expect(seen).toHaveLength(1);
      expect(seen[0].tenantId).toBe("tenant-1");
    } finally {
      unsubscribe();
    }
  });

  it("publishes ExpenseUpdated after a successful update", async () => {
    const repo = fakeRepository();
    const service = new ExpenseService(repo, "tenant-1", "user-1");
    const seen: DomainEvent<{ expense: Expense }>[] = [];
    const unsubscribe = eventBus.subscribe<{ expense: Expense }>(EXPENSE_UPDATED, (e) => {
      seen.push(e);
    });
    try {
      await service.update({ ...baseInput(), id: "e1" });
      expect(seen).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it("publishes ExpenseDeleted after a successful delete", async () => {
    const repo = fakeRepository();
    const service = new ExpenseService(repo, "tenant-1", "user-1");
    const seen: DomainEvent<{ expenseId: string }>[] = [];
    const unsubscribe = eventBus.subscribe<{ expenseId: string }>(EXPENSE_DELETED, (e) => {
      seen.push(e);
    });
    try {
      await service.delete("e1");
      expect(repo.delete).toHaveBeenCalledWith("e1");
      expect(seen).toHaveLength(1);
      expect(seen[0].payload.expenseId).toBe("e1");
    } finally {
      unsubscribe();
    }
  });
});
