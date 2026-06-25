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

const DEFAULT_CATEGORIES = [
  "Rent", "Utilities", "Fuel", "Transport", "Salaries",
  "Supplies", "Inventory Purchases", "Marketing", "Maintenance", "Miscellaneous",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing?: any | null;
}

export function ExpenseDialog({ open, onOpenChange, editing }: Props) {
  const { tenant } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({
    title: "", category: "", amount: 0, expense_date: new Date().toISOString().slice(0, 10),
    payment_method: "cash", description: "", vendor_name: "", vendor_phone: "", vendor_email: "",
    status: "paid", recurrence: "none", receipt_url: "",
  });
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (open) {
      setForm({
        title: editing?.title ?? "",
        category: editing?.category ?? "",
        amount: editing?.amount ?? 0,
        expense_date: editing?.expense_date ?? new Date().toISOString().slice(0, 10),
        payment_method: editing?.payment_method ?? "cash",
        description: editing?.description ?? "",
        vendor_name: editing?.vendor_name ?? "",
        vendor_phone: editing?.vendor_phone ?? "",
        vendor_email: editing?.vendor_email ?? "",
        status: editing?.status ?? "paid",
        recurrence: editing?.recurrence ?? "none",
        receipt_url: editing?.receipt_url ?? "",
      });
      setNewCategory("");
    }
  }, [open, editing]);

  const { data: customCats = [] } = useQuery({
    queryKey: ["expense-categories", tenant?.id],
    enabled: !!tenant?.id && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("expense_categories").select("name").order("name");
      return (data ?? []).map((r: any) => r.name as string);
    },
  });

  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCats]));

  const save = useMutation({
    mutationFn: async () => {
      const cat = newCategory.trim() || form.category;
      if (!cat) throw new Error("Category required");
      if (newCategory.trim()) {
        await (supabase as any).from("expense_categories").upsert(
          { tenant_id: tenant?.id, name: newCategory.trim() },
          { onConflict: "tenant_id,name" },
        );
      }
      const payload = { ...form, category: cat, tenant_id: tenant?.id };
      if (editing?.id) {
        const { error } = await (supabase as any).from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("expenses").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Expense updated" : "Expense recorded");
      qc.invalidateQueries({ queryKey: ["resource", "expenses"] });
      qc.invalidateQueries({ queryKey: ["expense-categories"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "New Expense"}</DialogTitle></DialogHeader>

        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Label>Title</Label><Input className="mt-1.5" value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. November electricity bill" /></div>
            <div>
              <Label>Category *</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={form.category} onChange={e => set("category", e.target.value)} required={!newCategory}>
                <option value="">— select —</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input className="mt-1.5" placeholder="Or add new category" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
            </div>
            <div><Label>Amount *</Label><Input className="mt-1.5" type="number" min="0" step="0.01" required value={form.amount} onChange={e => set("amount", Number(e.target.value))} /></div>
            <div><Label>Date *</Label><Input className="mt-1.5" type="date" required value={form.expense_date} onChange={e => set("expense_date", e.target.value)} /></div>
            <div>
              <Label>Payment method</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={form.payment_method} onChange={e => set("payment_method", e.target.value)}>
                <option value="cash">Cash</option><option value="mpesa">M-Pesa</option>
                <option value="bank">Bank</option><option value="card">Card</option><option value="credit">Credit</option>
              </select>
            </div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea className="mt-1.5" rows={2} value={form.description} onChange={e => set("description", e.target.value)} /></div>
          </section>

          <section className="border-t pt-4">
            <div className="text-sm font-medium mb-2">Vendor (optional)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.vendor_name} onChange={e => set("vendor_name", e.target.value)} /></div>
              <div><Label className="text-xs">Phone</Label><Input className="mt-1" value={form.vendor_phone} onChange={e => set("vendor_phone", e.target.value)} /></div>
              <div><Label className="text-xs">Email</Label><Input className="mt-1" type="email" value={form.vendor_email} onChange={e => set("vendor_email", e.target.value)} /></div>
            </div>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t pt-4">
            <div>
              <Label>Status</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="paid">Paid</option><option value="pending">Pending</option><option value="partial">Partially Paid</option>
              </select>
            </div>
            <div>
              <Label>Recurrence</Label>
              <select className="w-full h-9 px-3 rounded-md border bg-background text-sm mt-1.5" value={form.recurrence} onChange={e => set("recurrence", e.target.value)}>
                <option value="none">One-off</option><option value="daily">Daily</option>
                <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div><Label>Receipt URL</Label><Input className="mt-1.5" value={form.receipt_url} onChange={e => set("receipt_url", e.target.value)} placeholder="https://…" /></div>
          </section>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save Expense"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
