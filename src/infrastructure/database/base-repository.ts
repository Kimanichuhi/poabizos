import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DatabaseError } from "@shared/errors/app-errors";

/**
 * Base class for module repositories.
 *
 * A repository is the ONLY layer allowed to call `.from(...)`/`.rpc(...)` on
 * a Supabase client for its domain. It does not decide *whether* a client is
 * request-scoped (RLS as the caller) or service-scoped (RLS bypassed) — the
 * caller injects whichever client is appropriate (typically
 * `context.supabase` from the existing `requireSupabaseAuth` server-fn
 * middleware, or the browser `supabase` client for client-only reads).
 */
export abstract class BaseRepository {
  constructor(protected readonly client: SupabaseClient<Database>) {}

  /** Wraps a Postgrest error into the shared `DatabaseError` type. */
  protected raise(error: PostgrestError, context: string): never {
    throw new DatabaseError(`${context}: ${error.message}`, error);
  }
}
