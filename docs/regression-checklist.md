# Regression Checklist — Products gating & package changes

Run after any change to: `subscription_packages`, `package_features`, `features`,
`change_tenant_package`, `tenant_has_feature`, `get_tenant_features`,
`FeatureGuard`, or product/inventory routes.

> Automated RLS isolation tests live in `docs/rls-regression-tests.sql`. Run with:
> `psql "$SUPABASE_DB_URL" -f docs/rls-regression-tests.sql`
> Expected output: a series of `PASS [...]` notices; the script ROLLBACKs at the end.

## 1. Products gating (Starter package)

- [ ] Sign in as a tenant whose `tenants.subscription_plan = 'starter'`
      with no row in `tenant_subscriptions` (legacy fallback).
- [ ] `/dashboard/inventory` (Products) loads without the "Feature locked" screen.
- [ ] `/dashboard/inventory/:productId` opens product detail; profit per unit
      is shown when both cost and price are set.
- [ ] Stock movement timeline shows `created_at` automatically (no manual entry needed).
- [ ] Locked Starter modules (e.g. Payroll, AI Assistant) show the new
      FeatureGuard screen with: feature key, current package name, required
      package name, and an "Upgrade to <Package>" button linking to
      `/dashboard/subscription`.

## 2. `change_tenant_package` — upgrades & downgrades

- [ ] As a `tenant_admin`, on `/dashboard/subscription`:
  - [ ] Upgrade Starter → Growth: success toast, no "subscription_plan is of
        type subscription_plan but expression is of type text" error.
  - [ ] Upgrade Growth → Business → Premium: each succeeds.
  - [ ] Downgrade Premium → Starter: success toast; Products module remains
        accessible; previously-unlocked modules now show FeatureGuard.
- [ ] DB sanity after each change:
  - `SELECT subscription_plan FROM tenants WHERE id = <tid>;` matches the new code.
  - Exactly one `tenant_subscriptions` row with `status='active'` for the tenant.
  - Previous active rows moved to `status='cancelled'`.
- [ ] As a non-admin (`manager` / `staff`), the package buttons are disabled
      and `change_tenant_package` RPC returns `Forbidden` if called directly.

## 3. Data preservation on downgrade

- [ ] Create payroll / HR / asset rows on Business plan.
- [ ] Downgrade to Starter — the rows remain in the database (verify with SQL);
      only the UI gates them behind FeatureGuard.
- [ ] Re-upgrade to Business — the data reappears in the UI unchanged.
