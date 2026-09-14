import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ExpenseRepository } from "../repositories/expense.repository";
import { DatabaseError } from "@shared/errors/app-errors";
import type { Expense } from "../types/expense.types";

interface FakeResult<T> {
  data: T;
  error: { message: string } | null;
}

/**
 * A minimal fake Supabase query builder: every chain method returns itself,
 * and the object is thenable (like the real Postgrest builder) so `await`
 * anywhere in the chain resolves to the configured `{ data, error }` result.
 * It doesn't literally implement Postgrest's builder interface, so the one
 * cast in `fakeClient` below is intentional rather than a stray `any`.
 */
function fakeQueryBuilder<T>(result: FakeResult<T>) {
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    single: () => builder,
    then: (resolve: (v: FakeResult<T>) => void) => resolve(result),
  };
  return builder;
}

function fakeClient<T>(result: FakeResult<T>): SupabaseClient<Database> {
  return { from: () => fakeQueryBuilder(result) } as unknown as SupabaseClient<Database>;
}

describe("ExpenseRepository", () => {
  it("list() returns rows on success", async () => {
    const rows = [{ id: "1", title: "Rent" } as Expense];
    const repo = new ExpenseRepository(fakeClient({ data: rows, error: null }));
    await expect(repo.list()).resolves.toEqual(rows);
  });

  it("list() defaults to an empty array when data is null", async () => {
    const repo = new ExpenseRepository(fakeClient<Expense[] | null>({ data: null, error: null }));
    await expect(repo.list()).resolves.toEqual([]);
  });

  it("list() throws DatabaseError on a Postgrest error", async () => {
    const repo = new ExpenseRepository(
      fakeClient<Expense[] | null>({ data: null, error: { message: "boom" } }),
    );
    await expect(repo.list()).rejects.toBeInstanceOf(DatabaseError);
  });

  it("create() returns the inserted row", async () => {
    const row = { id: "1", title: "Rent", amount: 100 } as Expense;
    const repo = new ExpenseRepository(fakeClient({ data: row, error: null }));
    await expect(repo.create({ category: "Rent", amount: 100, tenant_id: "t1" })).resolves.toEqual(
      row,
    );
  });

  it("delete() resolves without error", async () => {
    const repo = new ExpenseRepository(fakeClient({ data: null, error: null }));
    await expect(repo.delete("1")).resolves.toBeUndefined();
  });

  it("delete() throws DatabaseError on a Postgrest error", async () => {
    const repo = new ExpenseRepository(fakeClient({ data: null, error: { message: "boom" } }));
    await expect(repo.delete("1")).rejects.toBeInstanceOf(DatabaseError);
  });
});
