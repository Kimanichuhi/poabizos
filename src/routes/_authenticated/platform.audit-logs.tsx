import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPlatformAuditLogs, listTenantsBrief } from "@/lib/platform-admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/platform/audit-logs")({
  head: () => ({ meta: [{ title: "Audit Logs · Platform · PoaBiz OS" }] }),
  component: PlatformAuditLogs,
});

function toCsv(rows: any[]): string {
  const cols = ["created_at", "action", "table_name", "record_id", "tenant_id", "tenant_name", "user_id", "metadata"];
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  return `${cols.join(",")}\n${rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n")}\n`;
}

function PlatformAuditLogs() {
  const list = useServerFn(listPlatformAuditLogs);
  const listT = useServerFn(listTenantsBrief);
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [action, setAction] = useState("all");
  const [tenantId, setTenantId] = useState("all");
  const [query, setQuery] = useState("");

  const { data: tData } = useQuery({ queryKey: ["admin-tenants-brief"], queryFn: () => listT() });
  const tenants = (tData?.tenants ?? []) as { id: string; business_name: string }[];
  const tenantMap = useMemo(() => Object.fromEntries(tenants.map(t => [t.id, t.business_name])), [tenants]);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-audit", from, to, action, tenantId],
    queryFn: () => list({ data: { from, to, action: action === "all" ? undefined : action, tenantId: tenantId === "all" ? undefined : tenantId } }),
  });

  const rows = (data?.rows ?? []).map((r: any) => ({ ...r, tenant_name: tenantMap[r.tenant_id] ?? null }));
  const actionTypes = useMemo(() => Array.from(new Set(rows.map((r: any) => r.action).filter(Boolean))).sort() as string[], [rows]);
  const filtered = rows.filter((r: any) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return `${r.action ?? ""} ${r.table_name ?? ""} ${r.record_id ?? ""} ${r.tenant_name ?? ""} ${JSON.stringify(r.metadata ?? {})}`.toLowerCase().includes(q);
  });

  const download = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `platform-audit-${from}_to_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform audit logs</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {rows.length} events shown.</p>
        </div>
        <Button onClick={download} variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export CSV</Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Search</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input placeholder="Action, tenant, id…" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Action</Label>
            <select value={action} onChange={e => setAction(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
              <option value="all">All actions</option>
              {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Tenant</Label>
            <select value={tenantId} onChange={e => setTenantId(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
              <option value="all">All tenants</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.business_name}</option>)}
            </select>
          </div>
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1" /></div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Record</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && filtered.map((r: any) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                  <td className="px-4 py-2">{r.tenant_name ?? <span className="text-muted-foreground font-mono text-xs">{r.tenant_id ?? "—"}</span>}</td>
                  <td className="px-4 py-2 font-medium">{r.action}</td>
                  <td className="px-4 py-2">{r.table_name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.record_id ?? "—"}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[320px] truncate">{r.metadata ? JSON.stringify(r.metadata) : ""}</td>
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No matching events.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
