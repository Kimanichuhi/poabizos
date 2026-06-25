import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { ExpenseDialog } from "@/components/expense-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

function ExpensesPage() {
  const { tenant, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [search, setSearch] = useState("");

  const queryKey = ["resource", "expenses", tenant?.id];
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    enabled: !!tenant?.id || isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("expenses").select("*").order("expense_date", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const filtered = rows.filter((r: any) =>
    !search || [r.title, r.category, r.vendor_name].some((v: any) => String(v ?? "").toLowerCase().includes(search.toLowerCase())));

  const total = filtered.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground text-sm mt-1">Track outgoing money by category and vendor.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> New Expense</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search title, category, vendor…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <div className="text-sm text-muted-foreground ml-auto">Total shown: <span className="font-medium text-foreground">{fmtMoney(total)}</span></div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No expenses yet.</td></tr>
              ) : filtered.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">{fmtDate(r.expense_date)}</td>
                  <td className="px-4 py-3">{r.title ?? "—"}</td>
                  <td className="px-4 py-3">{r.category}</td>
                  <td className="px-4 py-3">{r.vendor_name ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{r.payment_method ?? "—"}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${r.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(Number(r.amount))}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this expense?")) del.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <ExpenseDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/expenses")({
  component: () => <FeatureGuard featureKey="expenses"><ExpensesPage /></FeatureGuard>,
});
