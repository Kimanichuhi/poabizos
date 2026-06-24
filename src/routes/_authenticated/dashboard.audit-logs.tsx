import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/audit-logs")({
  component: () => <RoleGuard roles={["tenant_admin","platform_super_admin"]}><AuditLogs /></RoleGuard>,
});

function AuditLogs() {
  const { tenant } = useAuth();
  const { data: rows = [] } = useQuery({
    queryKey: ["audit", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("audit_logs").select("*").eq("tenant_id", tenant!.id).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
        <p className="text-sm text-muted-foreground mt-1">Recent activity in this workspace (last 200 events).</p>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Table</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">User</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 text-muted-foreground">{fmtDateTime(r.created_at)}</td>
                <td className="px-4 py-2 font-medium">{r.action}</td>
                <td className="px-4 py-2">{r.table_name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.record_id ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{r.user_id ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No audit events yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
