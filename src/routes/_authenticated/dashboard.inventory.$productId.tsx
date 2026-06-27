import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductDialog } from "@/components/product-dialog";
import { ArrowLeft, Pencil, ArrowUpDown, Archive, ArchiveRestore } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

type Range = "7d" | "30d" | "90d" | "ytd" | "all";
const RANGES: { k: Range; label: string }[] = [
  { k: "7d", label: "7 days" }, { k: "30d", label: "30 days" },
  { k: "90d", label: "90 days" }, { k: "ytd", label: "YTD" }, { k: "all", label: "All time" },
];
function rangeStart(r: Range): Date | null {
  const now = new Date();
  if (r === "all") return null;
  if (r === "ytd") return new Date(now.getFullYear(), 0, 1);
  const days = r === "7d" ? 7 : r === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 86400_000);
}

function ProductDetail() {
  const { productId } = Route.useParams();
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("Restock");
  const [adjNotes, setAdjNotes] = useState("");

  const { data: product } = useQuery({
    queryKey: ["product", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("*").eq("id", productId).maybeSingle();
      return data;
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["movements", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("stock_movements").select("*").eq("product_id", productId).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: salesHistory = [] } = useQuery({
    queryKey: ["product-sales", productId],
    enabled: !!productId && !!tenant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("sale_items")
        .select("id, quantity, unit_price, line_total, sale:sales(id, sale_date, customer_name, payment_method)")
        .eq("product_id", productId).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const adjustMut = useMutation({
    mutationFn: async () => {
      if (!adjQty) throw new Error("Quantity required");
      const { error } = await (supabase as any).rpc("adjust_stock", {
        _product_id: productId, _change: adjQty, _reason: adjReason, _notes: adjNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock adjusted");
      qc.invalidateQueries({ queryKey: ["product", productId] });
      qc.invalidateQueries({ queryKey: ["movements", productId] });
      setAdjOpen(false); setAdjQty(0); setAdjNotes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const archive = useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await (supabase as any).from("products")
        .update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["product", productId] }); qc.invalidateQueries({ queryKey: ["resource", "products"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (!product) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const stockStatus = product.is_service ? "Service"
    : Number(product.stock_quantity) <= 0 ? "Out of Stock"
    : Number(product.stock_quantity) <= Number(product.reorder_level ?? 0) ? "Low Stock"
    : "In Stock";
  const inventoryValue = Number(product.cost ?? 0) * Number(product.stock_quantity ?? 0);
  const margin = Number(product.price ?? 0) - Number(product.cost ?? 0);
  const marginPct = product.price ? (margin / Number(product.price)) * 100 : 0;
  const totalSold = salesHistory.reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  const totalRevenue = salesHistory.reduce((s: number, r: any) => s + Number(r.line_total ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard/inventory"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{product.sku ?? "—"}</span>
              {product.category && <><span>·</span><span>{product.category}</span></>}
              {product.brand && <><span>·</span><span>{product.brand}</span></>}
              {product.archived_at && <Badge variant="destructive">Archived</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!product.is_service && <Button variant="outline" size="sm" onClick={() => setAdjOpen(true)}><ArrowUpDown className="h-4 w-4 mr-1" /> Adjust stock</Button>}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1" /> Edit</Button>
          <Button variant="outline" size="sm" onClick={() => archive.mutate(!product.archived_at)}>
            {product.archived_at ? <><ArchiveRestore className="h-4 w-4 mr-1" /> Restore</> : <><Archive className="h-4 w-4 mr-1" /> Archive</>}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Current stock</div><div className="text-2xl font-semibold mt-1">{product.is_service ? "—" : `${product.stock_quantity} ${product.unit ?? ""}`}</div><Badge className="mt-2" variant="outline">{stockStatus}</Badge></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Inventory value</div><div className="text-2xl font-semibold mt-1">{fmtMoney(inventoryValue)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Margin / unit</div><div className="text-2xl font-semibold mt-1">{fmtMoney(margin)}</div><div className="text-xs text-muted-foreground mt-1">{marginPct.toFixed(1)}%</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total sold</div><div className="text-2xl font-semibold mt-1">{totalSold}</div><div className="text-xs text-muted-foreground mt-1">{fmtMoney(totalRevenue)} revenue</div></Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Info */}
        <Card className="p-5 lg:col-span-1 space-y-2 text-sm">
          <h3 className="font-semibold mb-3">Product information</h3>
          <Row k="Name" v={product.name} />
          <Row k="SKU" v={product.sku} />
          <Row k="Barcode" v={product.barcode} />
          <Row k="Category" v={product.category} />
          <Row k="Brand" v={product.brand} />
          <Row k="Unit" v={product.unit} />
          <Row k="Cost price" v={fmtMoney(Number(product.cost ?? 0))} />
          <Row k="Selling price" v={fmtMoney(Number(product.price ?? 0))} />
          <Row k="Minimum stock" v={String(product.reorder_level ?? 0)} />
          <Row k="Status" v={product.status} />
          <Row k="Last updated" v={new Date(product.updated_at).toLocaleString()} />
          {product.description && <div className="pt-2 border-t"><div className="text-xs text-muted-foreground mb-1">Description</div><div>{product.description}</div></div>}
        </Card>

        {/* Movement timeline */}
        <Card className="p-0 overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b"><h3 className="font-semibold">Stock movement timeline</h3></div>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Reason</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Change</th>
                  <th className="px-4 py-2 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No movements yet.</td></tr>}
                {movements.map((m: any) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{m.reason ?? "—"}</td>
                    <td className="px-4 py-2"><Badge variant="outline" className="capitalize text-[10px]">{m.reference_type ?? "—"}</Badge></td>
                    <td className={`px-4 py-2 text-right font-medium ${Number(m.change) > 0 ? "text-success" : "text-destructive"}`}>
                      {Number(m.change) > 0 ? "+" : ""}{m.change}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{m.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>


      {/* Profit history */}
      <ProfitHistory salesHistory={salesHistory} cost={Number(product.cost ?? 0)} />

      {/* Sales history */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b"><h3 className="font-semibold">Recent sales</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Customer</th>
                <th className="px-4 py-2 text-left font-medium">Payment</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Unit price</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {salesHistory.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No sales yet.</td></tr>}
              {salesHistory.map((s: any) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2 whitespace-nowrap">{s.sale?.sale_date ?? "—"}</td>
                  <td className="px-4 py-2">{s.sale?.customer_name ?? "Walk-in"}</td>
                  <td className="px-4 py-2 capitalize">{s.sale?.payment_method ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{s.quantity}</td>
                  <td className="px-4 py-2 text-right">{fmtMoney(Number(s.unit_price))}</td>
                  <td className="px-4 py-2 text-right font-medium">{fmtMoney(Number(s.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ProductDialog open={editOpen} onOpenChange={setEditOpen} editing={product} />

      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Current: <span className="text-foreground font-medium">{product.stock_quantity}</span></div>
            <div><Label>Change (negative reduces)</Label><Input className="mt-1.5" type="number" step="1" value={adjQty} onChange={e => setAdjQty(Number(e.target.value))} /></div>
            <div>
              <Label>Reason</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={adjReason} onChange={e => setAdjReason(e.target.value)}>
                <option>Restock</option><option>Damage</option><option>Loss</option><option>Correction</option><option>Return</option>
              </select>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} className="mt-1.5" value={adjNotes} onChange={e => setAdjNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>Cancel</Button>
            <Button onClick={() => adjustMut.mutate()} disabled={adjustMut.isPending || !adjQty}>{adjustMut.isPending ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return <div className="flex justify-between gap-3"><span className="text-muted-foreground">{k}</span><span className="text-right font-medium">{v ?? "—"}</span></div>;
}

export const Route = createFileRoute("/_authenticated/dashboard/inventory/$productId")({
  component: () => <FeatureGuard featureKey="products"><ProductDetail /></FeatureGuard>,
});
