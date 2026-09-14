# PoaBiz OS — Modular Architecture

This describes the target module architecture PoaBiz OS is migrating toward,
and the conventions new/migrated code must follow. See
[`adr/0001-modular-ddd-foundation.md`](./adr/0001-modular-ddd-foundation.md)
for why this migration was started and how it's being sequenced.

## Layering

```
React component  (dumb — no business logic, no supabase.from calls)
      │
   Hook           (TanStack Query wrapper around a server function)
      │
Server Function   (createServerFn + requireSupabaseAuth middleware — auth/req boundary)
      │
   Service        (business rules, validation, publishes domain events)
      │
  Repository      (the ONLY layer allowed to call supabase.from/.rpc for its domain)
      │
   Supabase
```

Each business domain (expenses, sales, inventory, customers, …) is a **module**
under `src/modules/<domain>/` and owns everything about itself: components,
pages, hooks, services, repositories, validation, types, events, permissions,
and its server functions (`api/`). No feature's logic should be spread across
unrelated top-level folders.

## Route files stay in `src/routes/`

TanStack Start's file-based router requires actual route files to physically
live under `src/routes/` — `src/routeTree.gen.ts` is generated from that
folder's contents and must never be hand-edited. So a module's routing code
is **not** literally under `modules/<domain>/routes/`; instead:

- The real route file (e.g. `src/routes/_authenticated/dashboard.expenses.tsx`)
  stays exactly where it is, with the same file name and URL.
- Its body is reduced to a thin shim: route options (path, guards like
  `<FeatureGuard>`) plus one import of the module's page component
  (`@modules/expenses/pages/expenses-page`).

This keeps routing/regeneration untouched while still giving each module a
single owned `pages/` folder for its actual page implementation.

## Shared vs. module-owned code

- `src/shared/` — cross-cutting code with no domain knowledge: the error
  taxonomy (`shared/errors`), the domain event bus (`shared/events`), shared
  UI/hooks/validation utilities as they're extracted.
- `src/infrastructure/` — adapters to external systems: `infrastructure/database`
  (repository base class), and (added only when a module first needs them)
  `infrastructure/mpesa`, `infrastructure/sms`, `infrastructure/whatsapp`, etc.
  `src/integrations/supabase/` (the Lovable/Supabase-generated client, types,
  and auth middleware) is **not** moved here — it stays put and
  `infrastructure/database` wraps it rather than replacing it.
- `src/modules/<domain>/events/` — the domain's own event *definitions*
  (e.g. `ExpenseCreated`). Modules publish through the single shared bus in
  `src/shared/events/event-bus.ts`; there is intentionally no per-module bus.

We do **not** pre-create empty top-level `services/`, `repositories/`,
`workers/`, `jobs/`, or `sdk/` folders. Each is created by whichever phase
first needs it, to avoid unused scaffolding.

## Error taxonomy

Services and repositories throw one of the typed errors in
`src/shared/errors/app-errors.ts` (`ValidationError`, `PermissionError`,
`BusinessRuleError`, `DatabaseError`, `ExternalIntegrationError`,
`UnknownApplicationError`) instead of a bare `Error`, so callers can branch on
`error.code`.

## Permissions and feature flags — current state

Today's model (unchanged by this migration so far): 4 fixed roles
(`platform_super_admin`, `tenant_admin`, `manager`, `staff`) via
`src/lib/auth-context.tsx` + `user_roles`, and route-level gating via
`<FeatureGuard featureKey="...">` (`src/lib/feature-guard.tsx`), backed by the
tenant's subscription package. Module `permissions/` folders (e.g.
`modules/expenses/permissions/expense.permissions.ts`) currently just name and
reuse these existing checks — they do **not** introduce new restrictions.
A more granular per-action permission model is a separate, later initiative
that needs its own DB migration design (it touches RLS) and is out of scope
for the module-by-module migration.

## Migration playbook (per module)

1. Extract `types/`, `validation/` (zod) from the existing table shape/dialog.
2. Extract a `repositories/<x>.repository.ts` — move every `supabase.from(...)`
   call for that table out of route/dialog files into repository methods.
3. Extract a `services/<x>.service.ts` — move business rules (defaulting,
   category resolution, tenant/created_by injection) out of the dialog's
   mutation function into service methods; publish domain events.
4. Add `api/<x>.functions.ts` server functions (mirrors the existing
   `src/lib/notifications.functions.ts` pattern) that call the service.
5. Add `hooks/use-<x>.ts` TanStack Query hooks calling the server functions.
6. Move the page/dialog components into `pages/` and `components/`, swap their
   inline Supabase calls for the new hooks.
7. Reduce the real route file in `src/routes/` to the thin shim described
   above.
8. Delete the old file(s) only after grepping for other importers.
9. Add service/repository unit tests.
