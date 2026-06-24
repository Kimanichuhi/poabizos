import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/stock-reports")({
  component: () => <FeatureGuard featureKey="stock_reports"><StockReports /></FeatureGuard>,
});

function StockReports() {
  const { tenant } = useAuth();
  const tid = tenant?.id;
  const { data: products = [] } = useQuery({
    queryKey: ["stock", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("*").eq("tenant_id", tid).order("stock_quantity", { ascending: true });
      return data ?? [];
    },
  });
  const totalValue = products.reduce((a: number, p: any) => a + Number(p.cost ?? 0) * Number(p.stock_quantity ?? 0), 0);
  const low = products.filter((p: any) => Number(p.stock_quantity ?? 0) <= Number(p.reorder_level ?? 0));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Stock reports</h1>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Products</div><div className="text-2xl font-semibold mt-1">{products.length}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Inventory value</div><div className="text-2xl font-semibold mt-1">{fmtMoney(totalValue)}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Below reorder level</div><div className="text-2xl font-semibold mt-1 text-warning">{low.length}</div></Card>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b font-medium">All products</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Stock</th><th className="px-4 py-2">Reorder</th><th className="px-4 py-2">Value</th></tr>
          </thead>
          <tbody>
            {products.map((p: any) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.name} {Number(p.stock_quantity) <= Number(p.reorder_level) && <Badge variant="destructive" className="ml-1">low</Badge>}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.sku ?? "—"}</td>
                <td className="px-4 py-2">{p.stock_quantity}</td>
                <td className="px-4 py-2">{p.reorder_level}</td>
                <td className="px-4 py-2">{fmtMoney(Number(p.cost ?? 0) * Number(p.stock_quantity ?? 0))}</td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No products yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
