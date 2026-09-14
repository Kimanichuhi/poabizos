import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { PermissionError } from "@shared/errors/app-errors";

/**
 * Resolves the calling user's `tenant_id` from `profiles`, the same lookup
 * already duplicated across `src/lib/tenant-admin.functions.ts` and
 * `src/lib/ai-chat.functions.ts`. Formalized here so new module services
 * don't repeat it a fourth time.
 */
export async function getCallerTenantId(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data } = await client.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  const tenantId = data?.tenant_id;
  if (!tenantId) throw new PermissionError("No workspace associated with this account");
  return tenantId;
}
