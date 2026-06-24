import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/platform/requests")({
  component: Requests,
});

function Requests() {
  const { data: rows = [] } = useQuery({
    queryKey: ["reg-requests"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("tenant_registration_requests").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registration requests</h1>
        <p className="text-muted-foreground text-sm mt-1">Audit log of every business that has signed up. Auto-approval is enabled — tenants are created instantly.</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
            <tr><th className="px-4 py-3">Business</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">When</th></tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.business_name}<div className="text-xs text-muted-foreground">{r.business_type ?? "—"}</div></td>
                <td className="px-4 py-3">{r.owner_name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="px-4 py-3"><Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"} className="capitalize">{r.status}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(r.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No registration requests yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
