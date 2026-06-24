import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/platform/tenants")({
  component: Tenants,
});

const PLANS = ["starter","growth","business","premium"] as const;

function Tenants() {
  const qc = useQueryClient();
  const { data: tenants = [] } = useQuery({
    queryKey: ["all-tenants"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tenants").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from("tenants").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tenant updated"); qc.invalidateQueries({ queryKey: ["all-tenants"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage all businesses on the platform — change plans, suspend, or reactivate.</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
            <tr><th className="px-4 py-3">Business</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th></th></tr>
          </thead>
          <tbody>
            {tenants.map((t: any) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3 font-medium">{t.business_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.business_type ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{t.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={t.subscription_plan}
                    onChange={e => update.mutate({ id: t.id, patch: { subscription_plan: e.target.value } })}
                    className="h-8 px-2 rounded-md border bg-background text-sm capitalize"
                  >
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={t.subscription_status === "active" ? "default" : t.subscription_status === "suspended" ? "destructive" : "secondary"} className="capitalize">{t.subscription_status}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(t.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  {t.subscription_status === "active" ? (
                    <Button size="sm" variant="outline" onClick={() => update.mutate({ id: t.id, patch: { subscription_status: "suspended" } })}>Suspend</Button>
                  ) : (
                    <Button size="sm" onClick={() => update.mutate({ id: t.id, patch: { subscription_status: "active" } })}>Activate</Button>
                  )}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No tenants yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
