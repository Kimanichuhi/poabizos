import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { fmtMoney } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  component: () => (
    <FeatureGuard featureKey="reports"><Reports /></FeatureGuard>
  ),
});

function Reports() {
  const { tenant } = useAuth();
  const tid = tenant?.id;
  const { data } = useQuery({
    queryKey: ["reports", tid],
    enabled: !!tid,
    queryFn: async () => {
      const s = supabase as any;
      const [{ data: sales }, { data: expenses }] = await Promise.all([
        s.from("sales").select("total_amount, created_at").eq("tenant_id", tid),
        s.from("expenses").select("amount, expense_date").eq("tenant_id", tid),
      ]);
      const byMonth: Record<string, { month: string; sales: number; expenses: number }> = {};
      const k = (d: string) => d.slice(0, 7);
      (sales ?? []).forEach((r: any) => {
        const m = k(r.created_at);
        byMonth[m] ??= { month: m, sales: 0, expenses: 0 };
        byMonth[m].sales += Number(r.total_amount ?? 0);
      });
      (expenses ?? []).forEach((r: any) => {
        const m = k(r.expense_date ?? r.created_at);
        byMonth[m] ??= { month: m, sales: 0, expenses: 0 };
        byMonth[m].expenses += Number(r.amount ?? 0);
      });
      const series = Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
      const totalSales = (sales ?? []).reduce((a: number, r: any) => a + Number(r.total_amount ?? 0), 0);
      const totalExpenses = (expenses ?? []).reduce((a: number, r: any) => a + Number(r.amount ?? 0), 0);
      return { series, totalSales, totalExpenses, profit: totalSales - totalExpenses };
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Total sales</div><div className="text-2xl font-semibold mt-1">{fmtMoney(data?.totalSales ?? 0)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Total expenses</div><div className="text-2xl font-semibold mt-1">{fmtMoney(data?.totalExpenses ?? 0)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Net</div><div className={`text-2xl font-semibold mt-1 ${(data?.profit ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney(data?.profit ?? 0)}</div></Card>
      </div>
      <Card className="p-5">
        <h3 className="font-medium mb-4">Monthly sales vs expenses</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data?.series ?? []}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
