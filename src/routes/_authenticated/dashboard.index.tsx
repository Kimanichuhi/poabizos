import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/format";
import { ShoppingCart, Wallet, Users, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function StatCard({ icon: Icon, label, value, sub }: any) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function DashboardHome() {
  const { tenant, profile, hasFeature } = useAuth();
  const tid = tenant?.id;
  const { data } = useQuery({
    queryKey: ["overview", tid],
    enabled: !!tid,
    queryFn: async () => {
      const s = (supabase as any);
      const [sales, expenses, customers, products] = await Promise.all([
        hasFeature("sales") ? s.from("sales").select("total_amount").eq("tenant_id", tid) : { data: [] },
        hasFeature("expenses") ? s.from("expenses").select("amount").eq("tenant_id", tid) : { data: [] },
        hasFeature("customers") ? s.from("customers").select("id", { count: "exact", head: true }).eq("tenant_id", tid) : { count: 0 },
        hasFeature("inventory") ? s.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tid) : { count: 0 },
      ]);
      const salesTotal = (sales.data ?? []).reduce((a: number, r: any) => a + Number(r.total_amount ?? 0), 0);
      const expenseTotal = (expenses.data ?? []).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);
      return {
        salesTotal, expenseTotal,
        customers: customers.count ?? 0, products: products.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {profile?.full_name?.split(" ")[0] ?? "there"}</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-muted-foreground text-sm">{tenant?.business_name}</p>
          <Badge variant="secondary" className="capitalize">{tenant?.subscription_plan} plan</Badge>
          <Badge variant={tenant?.subscription_status === "active" ? "default" : "destructive"} className="capitalize">{tenant?.subscription_status}</Badge>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Total sales" value={fmtMoney(data?.salesTotal ?? 0)} sub="All time" />
        <StatCard icon={Wallet} label="Total expenses" value={fmtMoney(data?.expenseTotal ?? 0)} sub="All time" />
        <StatCard icon={Users} label="Customers" value={data?.customers ?? 0} />
        <StatCard icon={Package} label="Products" value={data?.products ?? 0} />
      </div>
      <Card className="p-5">
        <h3 className="font-medium mb-2">Getting started</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
          <li>Add your first customers and products from the sidebar.</li>
          <li>Record sales and expenses as they happen.</li>
          <li>Invite your team in <span className="text-foreground">Users & Roles</span>.</li>
          <li>Need more features? Ask the platform admin to upgrade your plan.</li>
        </ul>
      </Card>
    </div>
  );
}
