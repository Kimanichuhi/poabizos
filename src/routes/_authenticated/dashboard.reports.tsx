import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtMoney } from "@/lib/format";
import { exportToExcel, exportToPDF, type ExportColumn } from "@/lib/exporters";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { FileDown, FileSpreadsheet } from "lucide-react";

function ReportTable({ title, columns, rows, footer }: { title: string; columns: ExportColumn[]; rows: any[]; footer?: string }) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportToExcel(title.replace(/\s+/g, "_"), rows, columns)}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportToPDF({ filename: title.replace(/\s+/g, "_"), title, rows, columns, footer })}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>{columns.map(c => <th key={c.key} className="px-4 py-2 text-left font-medium">{c.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">No data.</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t">
                {columns.map(c => <td key={c.key} className="px-4 py-2">{c.format ? c.format(r[c.key], r) : (r[c.key] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className="px-5 py-3 border-t text-sm font-medium bg-muted/30">{footer}</div>}
    </Card>
  );
}

function ReportsPage() {
  const { tenant } = useAuth();
  const tid = tenant?.id;
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data: products = [] } = useQuery({
    queryKey: ["rep-products", tid],
    enabled: !!tid,
    queryFn: async () => (await (supabase as any).from("products").select("*").is("archived_at", null)).data ?? [],
  });

  const { data: saleItems = [] } = useQuery({
    queryKey: ["rep-sale-items", tid, from, to],
    enabled: !!tid,
    queryFn: async () => (await (supabase as any).from("sale_items")
      .select("product_id, description, quantity, unit_price, line_total, sale:sales(sale_date, total_amount)")
      .gte("created_at", from).lte("created_at", `${to}T23:59:59`)).data ?? [],
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["rep-sales", tid, from, to],
    enabled: !!tid,
    queryFn: async () => (await (supabase as any).from("sales")
      .select("total_amount, sale_date").gte("sale_date", from).lte("sale_date", to)).data ?? [],
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["rep-expenses", tid, from, to],
    enabled: !!tid,
    queryFn: async () => (await (supabase as any).from("expenses")
      .select("amount, category, expense_date").gte("expense_date", from).lte("expense_date", to)).data ?? [],
  });

  // Aggregations
  const inventorySummary = products.map((p: any) => ({
    name: p.name, sku: p.sku, category: p.category,
    stock: p.is_service ? "—" : p.stock_quantity,
    cost: Number(p.cost ?? 0), price: Number(p.price ?? 0),
    value: p.is_service ? 0 : Number(p.cost ?? 0) * Number(p.stock_quantity ?? 0),
    status: p.is_service ? "Service"
      : Number(p.stock_quantity) <= 0 ? "Out of Stock"
      : Number(p.stock_quantity) <= Number(p.reorder_level ?? 0) ? "Low Stock" : "In Stock",
  }));

  const productSales = useMemo(() => {
    const agg: Record<string, { name: string; qty: number; revenue: number }> = {};
    saleItems.forEach((s: any) => {
      const key = s.product_id ?? s.description;
      agg[key] ??= { name: s.description, qty: 0, revenue: 0 };
      agg[key].qty += Number(s.quantity ?? 0);
      agg[key].revenue += Number(s.line_total ?? 0);
    });
    return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
  }, [saleItems]);

  const totalSales = sales.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const totalExpenses = expenses.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const totalInventoryValue = inventorySummary.reduce((s, r) => s + Number(r.value ?? 0), 0);
  const lowStock = inventorySummary.filter(r => r.status === "Low Stock" || r.status === "Out of Stock");
  const bestSelling = productSales.slice(0, 10);
  const leastSelling = [...productSales].reverse().slice(0, 10);

  const pl = useMemo(() => {
    // group by month
    const m: Record<string, { month: string; sales: number; expenses: number }> = {};
    sales.forEach((r: any) => {
      const k = (r.sale_date ?? "").slice(0, 7);
      m[k] ??= { month: k, sales: 0, expenses: 0 };
      m[k].sales += Number(r.total_amount ?? 0);
    });
    expenses.forEach((r: any) => {
      const k = (r.expense_date ?? "").slice(0, 7);
      m[k] ??= { month: k, sales: 0, expenses: 0 };
      m[k].expenses += Number(r.amount ?? 0);
    });
    return Object.values(m).sort((a, b) => a.month.localeCompare(b.month));
  }, [sales, expenses]);

  const money = (v: any) => fmtMoney(Number(v ?? 0));

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Export inventory, sales and finance reports as PDF or Excel.</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 h-9" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 h-9" /></div>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total sales</div><div className="text-xl font-semibold mt-1">{money(totalSales)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total expenses</div><div className="text-xl font-semibold mt-1">{money(totalExpenses)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Net</div><div className={`text-xl font-semibold mt-1 ${totalSales - totalExpenses >= 0 ? "text-success" : "text-destructive"}`}>{money(totalSales - totalExpenses)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Inventory value</div><div className="text-xl font-semibold mt-1">{money(totalInventoryValue)}</div></Card>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="inventory">Inventory Summary</TabsTrigger>
          <TabsTrigger value="product-sales">Product Sales</TabsTrigger>
          <TabsTrigger value="valuation">Inventory Valuation</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
          <TabsTrigger value="best">Best Selling</TabsTrigger>
          <TabsTrigger value="least">Least Selling</TabsTrigger>
          <TabsTrigger value="pl">Profit &amp; Loss</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-4">
          <ReportTable
            title="Inventory Summary"
            rows={inventorySummary}
            footer={`${inventorySummary.length} products`}
            columns={[
              { header: "Product", key: "name" },
              { header: "SKU", key: "sku" },
              { header: "Category", key: "category" },
              { header: "Stock", key: "stock" },
              { header: "Cost", key: "cost", format: money },
              { header: "Price", key: "price", format: money },
              { header: "Status", key: "status" },
            ]}
          />
        </TabsContent>

        <TabsContent value="product-sales" className="mt-4">
          <ReportTable
            title="Product Sales Report"
            rows={productSales}
            footer={`${productSales.length} products · ${money(productSales.reduce((s, r) => s + r.revenue, 0))} total revenue`}
            columns={[
              { header: "Product", key: "name" },
              { header: "Quantity", key: "qty" },
              { header: "Revenue", key: "revenue", format: money },
            ]}
          />
        </TabsContent>

        <TabsContent value="valuation" className="mt-4">
          <ReportTable
            title="Inventory Valuation"
            rows={inventorySummary.filter(r => r.value > 0)}
            footer={`Total inventory value: ${money(totalInventoryValue)}`}
            columns={[
              { header: "Product", key: "name" },
              { header: "SKU", key: "sku" },
              { header: "Stock", key: "stock" },
              { header: "Cost/unit", key: "cost", format: money },
              { header: "Value", key: "value", format: money },
            ]}
          />
        </TabsContent>

        <TabsContent value="low-stock" className="mt-4">
          <ReportTable
            title="Low Stock Report"
            rows={lowStock}
            footer={`${lowStock.length} products need attention`}
            columns={[
              { header: "Product", key: "name" },
              { header: "SKU", key: "sku" },
              { header: "Stock", key: "stock" },
              { header: "Status", key: "status" },
            ]}
          />
        </TabsContent>

        <TabsContent value="best" className="mt-4">
          <ReportTable
            title="Best Selling Products"
            rows={bestSelling}
            columns={[
              { header: "Product", key: "name" },
              { header: "Units sold", key: "qty" },
              { header: "Revenue", key: "revenue", format: money },
            ]}
          />
        </TabsContent>

        <TabsContent value="least" className="mt-4">
          <ReportTable
            title="Least Selling Products"
            rows={leastSelling}
            columns={[
              { header: "Product", key: "name" },
              { header: "Units sold", key: "qty" },
              { header: "Revenue", key: "revenue", format: money },
            ]}
          />
        </TabsContent>

        <TabsContent value="pl" className="mt-4 space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold mb-4">Monthly sales vs expenses</h3>
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={pl}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="sales" fill="var(--color-primary)" radius={[4,4,0,0]} />
                  <Bar dataKey="expenses" fill="var(--color-destructive)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <ReportTable
            title="Profit and Loss"
            rows={pl.map(r => ({ ...r, profit: r.sales - r.expenses }))}
            footer={`Net: ${money(totalSales - totalExpenses)}`}
            columns={[
              { header: "Month", key: "month" },
              { header: "Sales", key: "sales", format: money },
              { header: "Expenses", key: "expenses", format: money },
              { header: "Profit", key: "profit", format: money },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/reports")({
  component: () => <FeatureGuard featureKey="reports"><ReportsPage /></FeatureGuard>,
});
