import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTenantSubscriptions, changeTenantPackage, setTenantStatus, listPackages } from "@/lib/platform-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/platform/subscriptions")({
  head: () => ({ meta: [{ title: "Subscriptions · Platform · PoaBiz OS" }] }),
  component: SubscriptionsAdmin,
});

function SubscriptionsAdmin() {
  const list = useServerFn(listTenantSubscriptions);
  const listPkgs = useServerFn(listPackages);
  const change = useServerFn(changeTenantPackage);
  const setStatus = useServerFn(setTenantStatus);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin-subs"], queryFn: () => list() });
  const { data: pkgData } = useQuery({ queryKey: ["admin-packages-sel"], queryFn: () => listPkgs() });

  const onChangePkg = async (tenantId: string, code: string) => {
    try { await change({ data: { tenantId, packageCode: code } }); toast.success("Package changed. Tenant notified."); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  const onChangeStatus = async (tenantId: string, status: string) => {
    try { await setStatus({ data: { tenantId, status } }); toast.success("Status updated. Tenant notified."); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="grid gap-3">
        {(data?.tenants ?? []).map((t: any) => (
          <Card key={t.id} className="p-4 grid md:grid-cols-[1fr_auto_auto] gap-3 items-center">
            <div>
              <div className="font-medium">{t.business_name}</div>
              <div className="text-xs text-muted-foreground">{t.email || "no email"}</div>
              <div className="mt-1 flex gap-2 text-xs">
                <Badge variant="outline" className="capitalize">{t.subscription_plan}</Badge>
                <Badge variant={t.subscription_status === "active" ? "default" : t.subscription_status === "suspended" ? "destructive" : "secondary"} className="capitalize">
                  {t.subscription_status}
                </Badge>
              </div>
            </div>
            <Select value={t.subscription_plan} onValueChange={(v) => onChangePkg(t.id, v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(pkgData?.packages ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.package_code}>{p.package_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={t.subscription_status} onValueChange={(v) => onChangeStatus(t.id, v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </Card>
        ))}
        {(data?.tenants ?? []).length === 0 && !isLoading && (
          <div className="text-sm text-muted-foreground text-center py-8">No tenants yet.</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Changing a package or status sends an in-app notification to the affected workspace.</p>
    </div>
  );
}

// Button import kept in case future actions are added
void Button;
