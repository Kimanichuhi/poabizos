import { Link } from "@tanstack/react-router";
import { useAuth } from "./auth-context";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";

export function FeatureGuard({ featureKey, children }: { featureKey: string; children: ReactNode }) {
  const { hasFeature, tenant, isPlatformAdmin } = useAuth();
  if (isPlatformAdmin) return <>{children}</>;
  if (hasFeature(featureKey)) return <>{children}</>;
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="rounded-full bg-muted p-4 mb-4"><Lock className="h-8 w-8 text-muted-foreground" /></div>
      <h2 className="text-xl font-semibold">Feature not in your plan</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        The <span className="font-mono text-foreground">{featureKey}</span> module isn't available on the{" "}
        <span className="font-semibold">{tenant?.subscription_plan ?? "current"}</span> plan.
        Upgrade to unlock it.
      </p>
      <Link to="/dashboard" className="mt-6 text-primary hover:underline">← Back to dashboard</Link>
    </div>
  );
}

export function RoleGuard({ roles, children, fallback }: { roles: ("platform_super_admin"|"tenant_admin"|"manager"|"staff")[]; children: ReactNode; fallback?: ReactNode }) {
  const { hasRole } = useAuth();
  const ok = roles.some(r => hasRole(r));
  if (!ok) return <>{fallback ?? <div className="p-8 text-center text-muted-foreground">You don't have access to this page.</div>}</>;
  return <>{children}</>;
}
