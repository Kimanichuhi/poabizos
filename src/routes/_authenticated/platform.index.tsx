import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Building, Users, Activity, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/")({
  component: PlatformOverview,
});

function PlatformOverview() {
  const { data } = useQuery({
    queryKey: ["platform-overview"],
    queryFn: async () => {
      const s = supabase as any;
      const [tenants, profiles, requests] = await Promise.all([
        s.from("tenants").select("subscription_plan, subscription_status, created_at"),
        s.from("profiles").select("id", { count: "exact", head: true }),
        s.from("tenant_registration_requests").select("id", { count: "exact", head: true }),
      ]);
      const list = tenants.data ?? [];
      const byPlan: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      list.forEach((t: any) => {
        byPlan[t.subscription_plan] = (byPlan[t.subscription_plan] ?? 0) + 1;
        byStatus[t.subscription_status] = (byStatus[t.subscription_status] ?? 0) + 1;
      });
      return { totalTenants: list.length, totalUsers: profiles.count ?? 0, totalRequests: requests.count ?? 0, byPlan, byStatus };
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Building, label: "Tenants", value: data?.totalTenants ?? 0 },
          { icon: Users, label: "Total users", value: data?.totalUsers ?? 0 },
          { icon: Activity, label: "Active", value: data?.byStatus?.active ?? 0 },
          { icon: CreditCard, label: "Registrations", value: data?.totalRequests ?? 0 },
        ].map((s, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center justify-between"><div className="text-sm text-muted-foreground">{s.label}</div><s.icon className="h-4 w-4 text-primary" /></div>
            <div className="text-2xl font-semibold mt-2">{s.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-medium mb-3">Tenants by plan</h3>
          {Object.entries(data?.byPlan ?? {}).map(([p, n]) => (
            <div key={p} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0"><span className="capitalize">{p}</span><span className="font-medium">{n}</span></div>
          ))}
          {Object.keys(data?.byPlan ?? {}).length === 0 && <div className="text-sm text-muted-foreground">No tenants yet.</div>}
        </Card>
        <Card className="p-5">
          <h3 className="font-medium mb-3">By status</h3>
          {Object.entries(data?.byStatus ?? {}).map(([p, n]) => (
            <div key={p} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0"><span className="capitalize">{p}</span><span className="font-medium">{n}</span></div>
          ))}
          {Object.keys(data?.byStatus ?? {}).length === 0 && <div className="text-sm text-muted-foreground">—</div>}
        </Card>
      </div>
    </div>
  );
}
