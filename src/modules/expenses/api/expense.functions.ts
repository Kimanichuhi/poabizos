import { createServerFn } from "@tanstack/react-start";
import { ZodError } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { getCallerTenantId } from "@infrastructure/database/get-caller-tenant-id";
import { ValidationError } from "@shared/errors/app-errors";
import { ExpenseRepository } from "../repositories/expense.repository";
import { ExpenseService } from "../services/expense.service";
import { createExpenseSchema, updateExpenseSchema } from "../validation/expense.schema";
import type { CreateExpenseInput, UpdateExpenseInput } from "../types/expense.types";

function parseOrThrow<T>(schema: { parse: (d: unknown) => T }, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (e: unknown) {
    const message = e instanceof ZodError ? e.issues[0]?.message : undefined;
    throw new ValidationError(message ?? (e instanceof Error ? e.message : "Invalid input"));
  }
}

async function makeService(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const tenantId = await getCallerTenantId(context.supabase, context.userId);
  const repository = new ExpenseRepository(context.supabase);
  return new ExpenseService(repository, tenantId, context.userId);
}

export const listExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const service = await makeService(context);
    return { expenses: await service.list() };
  });

export const listExpenseCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const service = await makeService(context);
    return { categories: await service.listCategories() };
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseOrThrow<CreateExpenseInput>(createExpenseSchema, data))
  .handler(async ({ context, data }) => {
    const service = await makeService(context);
    return { expense: await service.create(data) };
  });

export const updateExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseOrThrow<UpdateExpenseInput>(updateExpenseSchema, data))
  .handler(async ({ context, data }) => {
    const service = await makeService(context);
    return { expense: await service.update(data) };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const id = (d as { id?: unknown } | undefined)?.id;
    if (!id || typeof id !== "string") throw new ValidationError("id required");
    return { id };
  })
  .handler(async ({ context, data }) => {
    const service = await makeService(context);
    await service.delete(data.id);
    return { ok: true };
  });
