import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const DEFAULT_CATEGORIES = ["Hair Products", "Cosmetics", "Electronics", "Furniture", "Agrovet", "Hardware", "General Merchandise"];

function genSku(name: string) {
  const base = (name || "PRD").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "PRD";
  return `${base}-${Date.now().toString().slice(-5)}`;
}

interface Props { open: boolean; onOpenChange: (v: boolean) => void; editing?: any | null; }

export function ProductDialog({ open, onOpenChange, editing }: Props) {
  const { tenant } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({
    name: "", sku: "", category: "", description: "",
    cost: 0, price: 0, stock_quantity: 0, reorder_level: 0,
    barcode: "", image_url: "", status: "active", is_service: false,
  });
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      name: editing?.name ?? "",
      sku: editing?.sku ?? "",
      category: editing?.category ?? "",
      description: editing?.description ?? "",
      cost: editing?.cost ?? 0,
      price: editing?.price ?? 0,
      stock_quantity: editing?.stock_quantity ?? 0,
      reorder_level: editing?.reorder_level ?? 0,
      barcode: editing?.barcode ?? "",
      image_url: editing?.image_url ?? "",
      status: editing?.status ?? "active",
      is_service: editing?.is_service ?? false,
    });
    setNewCategory("");
  }, [open, editing]);

  const { data: customCats = [] } = useQuery({
    queryKey: ["product-categories", tenant?.id],
    enabled: !!tenant?.id && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("product_categories").select("name").order("name");
      return (data ?? []).map((r: any) => r.name as string);
    },
  });
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats]));

  const save = useMutation({
    mutationFn: async () => {
      const cat = newCategory.trim() || form.category;
      if (newCategory.trim()) {
        await (supabase as any).from("product_categories").upsert({ tenant_id: tenant?.id, name: newCategory.trim() }, { onConflict: "tenant_id,name" });
      }
      const payload = {
        ...form,
        category: cat || null,
        sku: form.sku?.trim() || genSku(form.name),
        tenant_id: tenant?.id,
      };
      if (editing?.id) {
        const { error } = await (supabase as any).from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("products").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product added");
      qc.invalidateQueries({ queryKey: ["resource", "products"] });
      qc.invalidateQueries({ queryKey: ["products-lookup"] });
      qc.invalidateQueries({ queryKey: ["product-categories"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Name *</Label><Input className="mt-1.5" required value={form.name} onChange={e => set("name", e.target.value)} /></div>
            <div>
              <Label>SKU</Label>
              <div className="flex gap-2 mt-1.5">
                <Input value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="Auto" />
                <Button type="button" variant="outline" size="sm" onClick={() => set("sku", genSku(form.name))}>Generate</Button>
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={form.category} onChange={e => set("category", e.target.value)}>
                <option value="">— select —</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input className="mt-1.5" placeholder="Or add new category" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
            </div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea rows={2} className="mt-1.5" value={form.description} onChange={e => set("description", e.target.value)} /></div>
          </section>

          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t pt-4">
            <div><Label>Cost price</Label><Input className="mt-1.5" type="number" min="0" step="0.01" value={form.cost} onChange={e => set("cost", Number(e.target.value))} /></div>
            <div><Label>Selling price *</Label><Input className="mt-1.5" type="number" min="0" step="0.01" required value={form.price} onChange={e => set("price", Number(e.target.value))} /></div>
            <div><Label>Stock qty</Label><Input className="mt-1.5" type="number" min="0" value={form.stock_quantity} disabled={form.is_service} onChange={e => set("stock_quantity", Number(e.target.value))} /></div>
            <div><Label>Reorder at</Label><Input className="mt-1.5" type="number" min="0" value={form.reorder_level} disabled={form.is_service} onChange={e => set("reorder_level", Number(e.target.value))} /></div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-4">
            <div><Label>Barcode</Label><Input className="mt-1.5" value={form.barcode} onChange={e => set("barcode", e.target.value)} /></div>
            <div><Label>Image URL</Label><Input className="mt-1.5" value={form.image_url} onChange={e => set("image_url", e.target.value)} placeholder="https://…" /></div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-3">
              <input type="checkbox" checked={form.is_service} onChange={e => set("is_service", e.target.checked)} />
              This is a service (no stock tracking)
            </label>
          </section>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save Product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
