import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { ProductDialog } from "@/components/product-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Plus, Trash2, ArrowUpDown, ScanLine } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { BarcodeScanner } from "@/components/barcode-scanner";

function stockStatus(p: any): { label: string; klass: string } {
  if (p.is_service) return { label: "Service", klass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" };
  const q = Number(p.stock_quantity ?? 0);
  const r = Number(p.reorder_level ?? 0);
  if (q <= 0) return { label: "Out of Stock", klass: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" };
  if (q <= r) return { label: "Low Stock", klass: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" };
  return { label: "In Stock", klass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" };
}

function ProductsPage() {
  const { tenant, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [adjust, setAdjust] = useState<any | null>(null);
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("Restock");
  const [adjNotes, setAdjNotes] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  const onScan = async (code: string) => {
    const { data } = await (supabase as any).rpc("find_product_by_barcode", { _code: code });
    const found = Array.isArray(data) ? data[0] : data;
    if (!found) { toast.error(`No product for "${code}"`); return; }
    setAdjust(found); setAdjQty(1); setAdjReason("Restock"); setAdjNotes(`Scanned barcode ${code}`);
  };

  const queryKey = ["resource", "products", tenant?.id];
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    enabled: !!tenant?.id || isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("products").select("*").order("name").limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const adjustMut = useMutation({
    mutationFn: async () => {
      if (!adjust || !adjQty) throw new Error("Quantity required");
      const { error } = await (supabase as any).rpc("adjust_stock", {
        _product_id: adjust.id, _change: adjQty, _reason: adjReason, _notes: adjNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock adjusted");
      qc.invalidateQueries({ queryKey });
      setAdjust(null); setAdjQty(0); setAdjNotes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const filtered = rows.filter((p: any) => {
    if (search && !`${p.name} ${p.sku ?? ""} ${p.category ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "low") return !p.is_service && Number(p.stock_quantity) <= Number(p.reorder_level ?? 0) && Number(p.stock_quantity) > 0;
    if (filter === "out") return !p.is_service && Number(p.stock_quantity) <= 0;
    if (filter === "active") return p.status === "active";
    if (filter === "service") return !!p.is_service;
    return true;
  });

  const lowCount = rows.filter((p: any) => !p.is_service && Number(p.stock_quantity) <= Number(p.reorder_level ?? 0)).length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your products, services and stock levels.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScanOpen(true)} className="gap-2"><ScanLine className="h-4 w-4" /> Scan to add stock</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> New Product</Button>
        </div>
      </div>

      {lowCount > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          ⚠ {lowCount} product{lowCount > 1 ? "s are" : " is"} at or below reorder level.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search name, SKU, category…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="h-9 px-3 rounded-md border bg-background text-sm">
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="service">Services</option>
        </select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Cost</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No products. Click <span className="text-foreground font-medium">New Product</span> to add one.</td></tr>
              ) : filtered.map((p: any) => {
                const s = stockStatus(p);
                return (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium"><Link to="/dashboard/inventory/$productId" params={{ productId: p.id }} className="hover:underline">{p.name}</Link></td>
                    <td className="px-4 py-3 text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-3">{p.category ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{fmtMoney(Number(p.cost ?? 0))}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmtMoney(Number(p.price ?? 0))}</td>
                    <td className="px-4 py-3 text-right">{p.is_service ? "—" : p.stock_quantity}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${s.klass}`}>{s.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {!p.is_service && <Button size="sm" variant="ghost" title="Adjust stock" onClick={() => { setAdjust(p); setAdjQty(0); setAdjReason("Restock"); setAdjNotes(""); }}><ArrowUpDown className="h-3.5 w-3.5" /></Button>}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this product?")) del.mutate(p.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ProductDialog open={open} onOpenChange={setOpen} editing={editing} />

      <Dialog open={!!adjust} onOpenChange={(v) => !v && setAdjust(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust stock — {adjust?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Current stock: <span className="text-foreground font-medium">{adjust?.stock_quantity}</span></div>
            <div><Label>Change (use negative to reduce)</Label><Input className="mt-1.5" type="number" step="1" value={adjQty} onChange={e => setAdjQty(Number(e.target.value))} /></div>
            <div>
              <Label>Reason</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={adjReason} onChange={e => setAdjReason(e.target.value)}>
                <option>Restock</option><option>Damage</option><option>Loss</option><option>Correction</option><option>Return</option>
              </select>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} className="mt-1.5" value={adjNotes} onChange={e => setAdjNotes(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjust(null)}>Cancel</Button>
            <Button onClick={() => adjustMut.mutate()} disabled={adjustMut.isPending || !adjQty}>{adjustMut.isPending ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner open={scanOpen} onOpenChange={setScanOpen} onScan={onScan} title="Scan to add stock" />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/inventory")({
  component: () => <FeatureGuard featureKey="products"><ProductsPage /></FeatureGuard>,
});
