import { Link } from "@tanstack/react-router";
import { useAuth } from "./auth-context";
import type { ReactNode } from "react";
import { Lock, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FeatureGuard({ featureKey, children }: { featureKey: string; children: ReactNode }) {
  const { hasFeature, packageInfo, isPlatformAdmin, packageForFeature } = useAuth();
  if (isPlatformAdmin) return <>{children}</>;
  if (hasFeature(featureKey)) return <>{children}</>;

  const required = packageForFeature(featureKey);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
      <div className="rounded-full bg-muted p-4 mb-4"><Lock className="h-8 w-8 text-muted-foreground" /></div>
      <h2 className="text-xl font-semibold">Feature locked</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        {required
          ? <>This feature is available in the <span className="font-semibold text-foreground">{required.name}</span> package.</>
          : <>This feature isn't available on your current package.</>}
        {packageInfo && <> You're currently on <span className="font-semibold text-foreground">{packageInfo.package_name}</span>.</>}
      </p>
      <div className="flex gap-2 mt-6">
        <Button asChild><Link to="/dashboard/subscription">Upgrade Package <ArrowUpRight className="h-4 w-4 ml-1" /></Link></Button>
        <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    </div>
  );
}

export function RoleGuard({ roles, children, fallback }: { roles: ("platform_super_admin"|"tenant_admin"|"manager"|"staff")[]; children: ReactNode; fallback?: ReactNode }) {
  const { hasRole } = useAuth();
  const ok = roles.some(r => hasRole(r));
  if (!ok) return <>{fallback ?? <div className="p-8 text-center text-muted-foreground">You don't have access to this page.</div>}</>;
  return <>{children}</>;
}
