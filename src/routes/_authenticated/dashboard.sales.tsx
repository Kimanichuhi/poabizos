import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { FeatureGuard } from "@/lib/feature-guard";
import { SaleDialog } from "@/components/sale-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { toast } from "sonner";

function SalesPage() {
  const { tenant, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const queryKey = ["resource", "sales", tenant?.id];
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    enabled: !!tenant?.id || isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("sales").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const filtered = rows.filter((r: any) =>
    !search || [r.customer_name, r.sale_type, r.payment_method].some((v: any) => String(v ?? "").toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-muted-foreground text-sm mt-1">Record every sale your business makes.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Sale</Button>
      </div>

      <Input placeholder="Search by customer, type, payment method…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-right">Balance</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No sales yet.</td></tr>
              ) : filtered.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">{fmtDate(r.sale_date ?? r.created_at)}</td>
                  <td className="px-4 py-3">{r.customer_name ?? "Walk-in"}</td>
                  <td className="px-4 py-3 capitalize">{r.sale_type ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{r.payment_method ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium">{fmtMoney(Number(r.total_amount))}</td>
                  <td className="px-4 py-3 text-right">{Number(r.balance) > 0 ? <span className="text-destructive">{fmtMoney(Number(r.balance))}</span> : "—"}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${r.status === "completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this sale? Stock will NOT be restored.")) del.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <SaleDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/dashboard/sales")({
  component: () => <FeatureGuard featureKey="sales"><SalesPage /></FeatureGuard>,
});
