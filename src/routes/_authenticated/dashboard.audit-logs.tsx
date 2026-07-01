import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard/audit-logs")({
  component: () => <RoleGuard roles={["tenant_admin","platform_super_admin"]}><AuditLogs /></RoleGuard>,
});

function toCsv(rows: any[]): string {
  const cols = ["created_at", "action", "table_name", "record_id", "user_id", "user_name", "product", "metadata"];
  const esc = (v: any) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = cols.join(",");
  const body = rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n");
  return `${header}\n${body}\n`;
}

function AuditLogs() {
  const { tenant } = useAuth();
  const [action, setAction] = useState("all");
  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const { data: rows = [] } = useQuery({
    queryKey: ["audit", tenant?.id, from, to],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("audit_logs")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .gte("created_at", `${from}T00:00:00`)
        .lte("created_at", `${to}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["audit-users", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("id, full_name, email").eq("tenant_id", tenant!.id);
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["audit-products", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("products").select("id, name, sku");
      return data ?? [];
    },
  });

  const userMap = useMemo(() => Object.fromEntries(users.map((u: any) => [u.id, u])), [users]);
  const productMap = useMemo(() => Object.fromEntries(products.map((p: any) => [p.id, p])), [products]);

  const actionTypes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r: any) => r.action && set.add(r.action));
    return Array.from(set).sort();
  }, [rows]);

  const enriched = useMemo(() => rows.map((r: any) => {
    const u = userMap[r.user_id];
    // Try to resolve product name for product/stock rows
    let productName: string | null = null;
    if (r.table_name === "products" && productMap[r.record_id]) productName = productMap[r.record_id].name;
    if (r.table_name === "stock_movements") {
      const pid = r.metadata?.product_id;
      if (pid && productMap[pid]) productName = productMap[pid].name;
    }
    const product = productName ? { id: r.record_id, name: productName, sku: productMap[r.record_id]?.sku ?? null } : null;
    return {
      ...r,
      user_name: u?.full_name || u?.email || null,
      product: product?.name ?? null,
      product_sku: productMap[r.record_id]?.sku ?? null,
    };
  }), [rows, userMap, productMap]);

  const filtered = enriched.filter((r: any) => {
    if (action !== "all" && r.action !== action) return false;
    if (userFilter !== "all" && r.user_id !== userFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${r.action ?? ""} ${r.table_name ?? ""} ${r.record_id ?? ""} ${r.user_name ?? ""} ${r.product ?? ""} ${r.product_sku ?? ""} ${JSON.stringify(r.metadata ?? {})}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const download = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-${from}_to_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
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
              <Input placeholder="Product, SKU, id…" className="pl-8" value={query} onChange={e => setQuery(e.target.value)} />
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
            <Label className="text-xs">User</Label>
            <select value={userFilter} onChange={e => setUserFilter(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm">
              <option value="all">All users</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1" />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground text-left">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Product / record</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
                  <td className="px-4 py-2 font-medium">{r.action}</td>
                  <td className="px-4 py-2">{r.table_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.product ? (<div>{r.product}{r.product_sku && <span className="text-muted-foreground text-xs"> · {r.product_sku}</span>}</div>) : (<span className="text-muted-foreground font-mono text-xs">{r.record_id ?? "—"}</span>)}
                  </td>
                  <td className="px-4 py-2">{r.user_name ?? <span className="text-muted-foreground font-mono text-xs">{r.user_id ?? "—"}</span>}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-[320px] truncate">{r.metadata ? JSON.stringify(r.metadata) : ""}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No matching events.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
