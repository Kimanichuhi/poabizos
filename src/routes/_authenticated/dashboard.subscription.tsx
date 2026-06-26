import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowUpRight, ArrowDownRight, Shield } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";

interface Package {
  id: string; package_code: string; package_name: string; monthly_price: number;
  user_limit: number | null; description: string | null; sort_order: number;
}
interface FeatureRow { id: string; feature_key: string; feature_name: string; module: string | null; }

function SubscriptionPage() {
  const { tenant, packageInfo, refresh, isTenantAdmin, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ["all-packages"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("subscription_packages")
        .select("*").eq("is_active", true).order("sort_order");
      return data ?? [];
    },
  });

  const { data: features = [] } = useQuery<FeatureRow[]>({
    queryKey: ["all-features"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("features").select("*").order("module").order("feature_name");
      return data ?? [];
    },
  });

  const { data: matrix = [] } = useQuery<{ package_id: string; feature_id: string }[]>({
    queryKey: ["package-features-matrix"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("package_features").select("package_id, feature_id");
      return data ?? [];
    },
  });

  const hasFeat = (pkgId: string, featId: string) => matrix.some(m => m.package_id === pkgId && m.feature_id === featId);

  const change = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await (supabase as any).rpc("change_tenant_package", { _package_code: code });
      if (error) throw error;
    },
    onSuccess: async (_d, code) => {
      toast.success(`Switched to ${packages.find(p => p.package_code === code)?.package_name}`);
      await refresh();
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const canChange = isTenantAdmin || isPlatformAdmin;
  const currentCode = packageInfo?.package_code ?? tenant?.subscription_plan;
  const currentIdx = packages.findIndex(p => p.package_code === currentCode);

  const byModule: Record<string, FeatureRow[]> = {};
  features.forEach(f => { (byModule[f.module ?? "Other"] ??= []).push(f); });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Subscription</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your package, billing and feature access.</p>
      </div>

      {/* Current package */}
      <Card className="p-6 border-primary/30 bg-primary/5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Current Package</div>
            <div className="text-2xl font-semibold mt-1">{packageInfo?.package_name ?? "—"}</div>
            <div className="text-muted-foreground text-sm mt-1">{packageInfo?.description}</div>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> {tenant?.subscription_status}</Badge>
              <Badge variant="outline">{packageInfo?.user_limit ? `Up to ${packageInfo.user_limit} users` : "Unlimited users"}</Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Monthly price</div>
            <div className="text-3xl font-bold">{fmtMoney(packageInfo?.monthly_price ?? 0)}</div>
            <div className="text-xs text-muted-foreground">per month</div>
          </div>
        </div>
      </Card>

      {/* Package cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Available packages</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {packages.map((p, idx) => {
            const isCurrent = p.package_code === currentCode;
            const isUpgrade = idx > currentIdx;
            const pkgFeatures = features.filter(f => hasFeat(p.id, f.id));
            return (
              <Card key={p.id} className={`p-5 flex flex-col ${isCurrent ? "border-primary shadow-md" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.package_name}</div>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <div className="mt-3">
                  <span className="text-3xl font-bold">{fmtMoney(p.monthly_price)}</span>
                  <span className="text-sm text-muted-foreground"> /mo</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {p.user_limit ? `Up to ${p.user_limit} users` : "Unlimited users"}
                </div>
                <ul className="mt-4 space-y-1.5 text-sm flex-1 max-h-64 overflow-y-auto pr-1">
                  {pkgFeatures.slice(0, 12).map(f => (
                    <li key={f.id} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-success shrink-0 mt-0.5" /> <span>{f.feature_name}</span>
                    </li>
                  ))}
                  {pkgFeatures.length > 12 && (
                    <li className="text-xs text-muted-foreground">+ {pkgFeatures.length - 12} more features</li>
                  )}
                </ul>
                <Button
                  className="mt-4 w-full gap-1"
                  variant={isCurrent ? "outline" : isUpgrade ? "default" : "secondary"}
                  disabled={isCurrent || !canChange || change.isPending}
                  onClick={() => {
                    if (!confirm(`Switch to ${p.package_name} (${fmtMoney(p.monthly_price)}/mo)?`)) return;
                    change.mutate(p.package_code);
                  }}
                >
                  {isCurrent ? "Current plan"
                    : isUpgrade ? <>Upgrade <ArrowUpRight className="h-4 w-4" /></>
                    : <>Downgrade <ArrowDownRight className="h-4 w-4" /></>}
                </Button>
              </Card>
            );
          })}
        </div>
        {!canChange && (
          <p className="text-xs text-muted-foreground mt-3">Only tenant admins can change the package.</p>
        )}
      </div>

      {/* Comparison matrix */}
      <Card className="overflow-hidden p-0">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold">Feature comparison</h2>
          <p className="text-xs text-muted-foreground mt-1">Downgrading never deletes data — locked modules become available again on upgrade.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Feature</th>
                {packages.map(p => (
                  <th key={p.id} className="px-4 py-2.5 text-center font-medium">{p.package_name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(byModule).map(([module, list]) => (
                <Fragment key={module}>
                  <tr className="bg-muted/30">
                    <td colSpan={1 + packages.length} className="px-4 py-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">{module}</td>
                  </tr>
                  {list.map(f => (
                    <tr key={f.id} className="border-t">
                      <td className="px-4 py-2">{f.feature_name}</td>
                      {packages.map(p => (
                        <td key={p.id} className="px-4 py-2 text-center">
                          {hasFeat(p.id, f.id)
                            ? <Check className="h-4 w-4 text-success inline" />
                            : <X className="h-3.5 w-3.5 text-muted-foreground/40 inline" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/subscription")({
  component: SubscriptionPage,
});
