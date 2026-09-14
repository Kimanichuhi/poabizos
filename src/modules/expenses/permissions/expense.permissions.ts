import { useAuth } from "@/lib/auth-context";

/**
 * Names today's existing access rule for Expenses instead of introducing a
 * new one: any authenticated user belonging to a tenant whose subscription
 * includes the `expenses` feature can view/manage expenses (platform admins
 * always can). This matches exactly what `<FeatureGuard featureKey="expenses">`
 * already enforces at the route level — this hook exists so components below
 * the route (e.g. to conditionally show the "New Expense" button) can ask the
 * same question without re-deriving it. It does not add a new restriction;
 * introducing per-role restrictions for expenses is a separate, later
 * decision (see docs/architecture/overview.md).
 */
export function useCanManageExpenses(): boolean {
  const { isPlatformAdmin, hasFeature, profile } = useAuth();
  return isPlatformAdmin || (!!profile?.tenant_id && hasFeature("expenses"));
}
