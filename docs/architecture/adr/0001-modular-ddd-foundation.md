# ADR 0001: Modular DDD Foundation + Expenses Pilot

## Status
Accepted (Phase 0 + Phase 1 of an incremental, multi-phase migration).

## Context
PoaBiz OS's business logic lives directly inside route components and
dialogs — roughly 90 raw `supabase.from(...)` call sites spread across 16+
route files, a generic `resource-page.tsx` CRUD component, and 3 entity
dialogs, with no service/repository layer and no domain events. As the
product grows toward an enterprise-grade SaaS, this makes each domain hard to
test, reuse, or reason about in isolation, and couples the UI directly to the
database schema.

The app is actively synced with Lovable and in production use, so any
migration must:
- Never regress an existing route, feature, API, migration, RLS policy, or
  auth flow.
- Land incrementally — every commit compiles, lints, and passes checks.
- Not touch Lovable/Supabase-generated files (`src/integrations/supabase/`)
  or hand-edit `src/routeTree.gen.ts`.

## Decision
Adopt a layered module architecture (Route → Hook → Server Function →
Service → Repository → Supabase; see
[`overview.md`](../overview.md)) and migrate to it **module by module**,
proving the pattern first on one self-contained domain (Expenses) before
rolling it out further.

Phase 0 (this ADR) adds only additive, zero-behavior-change foundation:
- Path aliases `@modules/*`, `@shared/*`, `@infrastructure/*`, `@sdk/*`
  (alongside the existing `@/*`).
- `src/shared/errors/app-errors.ts` — standardized error taxonomy.
- `src/shared/events/` — a minimal in-memory domain event bus (publish now,
  subscribers added once ≥2 modules exist to decouple).
- `src/infrastructure/database/base-repository.ts` — the base class every
  module repository extends.
- `vitest` as the project's test runner (previously there was no JS test
  runner — only the SQL-based RLS regression suite).

Phase 1 migrates the **Expenses** domain end-to-end as the reference
implementation (see `src/modules/expenses/`), using the
`createServerFn().middleware([requireSupabaseAuth])` pattern already
established in `src/lib/notifications.functions.ts` — this is not a new
pattern for the codebase, just applied consistently to a domain that
previously called Supabase directly from the browser.

## Consequences
- Expenses' runtime call path changes from browser→Supabase directly to
  browser→server function→Supabase. RLS still applies identically (the
  existing middleware forwards the caller's JWT), so this is a structural
  change only, not a behavioral or security one.
- `src/routes/_authenticated/dashboard.expenses.tsx` becomes a thin shim
  importing `@modules/expenses/pages/expenses-page` — same URL, same route
  id, same `<FeatureGuard>` wrapping.
- Every other domain (sales, inventory, customers, …) is untouched by this
  ADR. Rolling this pattern out to them is tracked as follow-up work, one
  module at a time, per the playbook in `overview.md`.
- Granular per-action permissions, event subscribers, background
  workers/queues, and AI agents are explicitly deferred — each needs its own
  design decision and is out of scope here.
