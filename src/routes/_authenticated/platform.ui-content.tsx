import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listUiContent, saveUiContent,
  listTenantsBrief, sendBroadcast, listBroadcasts, listBroadcastDelivery,
} from "@/lib/platform-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Send, Eye, Bell, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/platform/ui-content")({
  head: () => ({ meta: [{ title: "UI Content & Broadcasts · Platform · PoaBiz OS" }] }),
  component: UiContentAdmin,
});

type Row = { key: string; value: unknown; updated_at: string };
type Tenant = { id: string; business_name: string; subscription_status: string };
type Broadcast = { created_at: string; title: string; body: string | null; tenant_count: number; read_count: number };
type DeliveryRow = { tenant_id: string; business_name: string; delivered_at: string; read_at: string | null };

function UiContentAdmin() {
  const list = useServerFn(listUiContent);
  const save = useServerFn(saveUiContent);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin-ui-content"], queryFn: () => list() });

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [broadcast, setBroadcast] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");

  useEffect(() => {
    if (!data?.items) return;
    const next: Record<string, string> = {};
    for (const r of data.items as Row[]) {
      next[r.key] = typeof r.value === "string" ? r.value : JSON.stringify(r.value, null, 2);
    }
    setDrafts(next);
  }, [data]);

  const submit = async (key: string) => {
    setBusy(key);
    try {
      let value: unknown = drafts[key];
      try { value = JSON.parse(drafts[key]); } catch { /* keep as string */ }
      await save({ data: { key, value, broadcast: !!broadcast[key] } });
      toast.success(broadcast[key] ? "Saved and announcement broadcast" : "Saved");
      setBroadcast((b) => ({ ...b, [key]: false }));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(null); }
  };

  const addNew = async () => {
    if (!newKey.trim()) { toast.error("Key is required"); return; }
    try {
      let v: unknown = newVal;
      try { v = JSON.parse(newVal); } catch { /* keep string */ }
      await save({ data: { key: newKey.trim(), value: v } });
      setNewKey(""); setNewVal("");
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">UI Content & Broadcasts</h1>
        <p className="text-sm text-muted-foreground">Edit landing copy, send broadcast notifications to tenants, and review delivery.</p>
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">UI Content</TabsTrigger>
          <TabsTrigger value="broadcast"><Bell className="h-3.5 w-3.5 mr-1" /> Broadcasts</TabsTrigger>
          <TabsTrigger value="log">Delivery log</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-3 mt-3">
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          <div className="grid gap-3">
            {(data?.items ?? []).map((r: Row) => (
              <Card key={r.key} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm">{r.key}</div>
                  <div className="text-xs text-muted-foreground">Updated {new Date(r.updated_at).toLocaleString()}</div>
                </div>
                <Textarea rows={3} value={drafts[r.key] ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.key]: e.target.value })} />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={!!broadcast[r.key]} onCheckedChange={(v) => setBroadcast({ ...broadcast, [r.key]: !!v })} />
                    Broadcast this change as an announcement to all workspaces
                  </label>
                  <Button size="sm" onClick={() => submit(r.key)} disabled={busy === r.key}>
                    {busy === r.key && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Save
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4 space-y-2">
            <div className="font-medium">Add new key</div>
            <div className="grid gap-2">
              <div><Label>Key</Label><Input value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="hero_cta_label" /></div>
              <div><Label>Value (text or JSON)</Label><Textarea rows={2} value={newVal} onChange={(e) => setNewVal(e.target.value)} /></div>
              <div><Button size="sm" onClick={addNew}><Plus className="h-4 w-4 mr-1" /> Add</Button></div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="broadcast" className="mt-3">
          <BroadcastComposer />
        </TabsContent>

        <TabsContent value="log" className="mt-3">
          <DeliveryLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BroadcastComposer() {
  const listT = useServerFn(listTenantsBrief);
  const send = useServerFn(sendBroadcast);
  const { data } = useQuery({ queryKey: ["admin-tenants-brief"], queryFn: () => listT() });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [q, setQ] = useState("");

  const tenants = (data?.tenants ?? []) as Tenant[];
  const filtered = useMemo(
    () => tenants.filter((t) => t.business_name.toLowerCase().includes(q.toLowerCase())),
    [tenants, q],
  );

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (target === "selected" && selected.size === 0) { toast.error("Pick at least one tenant"); return; }
    setBusy(true);
    try {
      const res = await send({ data: {
        title, body,
        tenantIds: target === "all" ? null : Array.from(selected),
      }});
      toast.success(`Delivered to ${res.delivered} workspaces`);
      setTitle(""); setBody(""); setSelected(new Set()); setPreview(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <Card className="p-4 space-y-3">
        <div className="font-medium flex items-center gap-2"><Send className="h-4 w-4" /> Compose broadcast</div>
        <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheduled maintenance tonight" /></div>
        <div><Label>Message</Label><Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details for the recipients…" /></div>
        <div className="space-y-2">
          <Label>Target</Label>
          <div className="flex gap-2 text-sm">
            <button onClick={() => setTarget("all")} className={`px-3 py-1.5 rounded-md border ${target === "all" ? "bg-primary text-primary-foreground border-primary" : ""}`}>All tenants ({tenants.length})</button>
            <button onClick={() => setTarget("selected")} className={`px-3 py-1.5 rounded-md border ${target === "selected" ? "bg-primary text-primary-foreground border-primary" : ""}`}>Selected ({selected.size})</button>
          </div>
        </div>
        {target === "selected" && (
          <div className="border rounded-md">
            <div className="p-2 border-b"><Input placeholder="Search tenants…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                  <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                  <span className="flex-1 truncate">{t.business_name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{t.subscription_status}</Badge>
                </label>
              ))}
              {filtered.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">No matches</div>}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreview(true)}><Eye className="h-4 w-4 mr-1" /> Preview</Button>
          <Button onClick={submit} disabled={busy}>{busy && <Loader2 className="h-3 w-3 animate-spin mr-1" />} Send</Button>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="font-medium flex items-center gap-2"><Users className="h-4 w-4" /> Live preview</div>
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <Bell className="h-4 w-4 mt-0.5 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{title || "Broadcast title"}</div>
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">{body || "Message body will appear here."}</div>
              <div className="text-[10px] text-muted-foreground mt-2">
                Target: {target === "all" ? `all ${tenants.length} workspaces` : `${selected.size} selected workspace(s)`}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent>
          <DialogHeader><DialogTitle>Broadcast preview</DialogTitle></DialogHeader>
          <div className="rounded-md border p-3">
            <div className="font-medium">{title || "(no title)"}</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{body}</div>
          </div>
          <div className="text-xs text-muted-foreground">Will be delivered to {target === "all" ? tenants.length : selected.size} workspace(s).</div>
          <Button onClick={submit} disabled={busy}>Send now</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryLog() {
  const list = useServerFn(listBroadcasts);
  const detail = useServerFn(listBroadcastDelivery);
  const { data } = useQuery({ queryKey: ["admin-broadcasts"], queryFn: () => list() });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const openDetail = async (b: Broadcast) => {
    const k = `${b.created_at}|${b.title}`;
    setOpenKey(k);
    setLoadingRows(true);
    try {
      const r = await detail({ data: { createdAt: b.created_at, title: b.title } });
      setRows((r.rows as DeliveryRow[]) ?? []);
    } catch { setRows([]); }
    setLoadingRows(false);
  };

  const items = (data?.broadcasts ?? []) as Broadcast[];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="divide-y">
        {items.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No broadcasts sent yet.</div>}
        {items.map((b) => {
          const k = `${b.created_at}|${b.title}`;
          const open = openKey === k;
          return (
            <div key={k}>
              <button onClick={() => openDetail(b)} className="w-full text-left p-3 hover:bg-accent/50 flex items-start gap-3">
                <Bell className="h-4 w-4 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{b.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{b.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })} · {b.tenant_count} tenants · {b.read_count} read
                  </div>
                </div>
              </button>
              {open && (
                <div className="p-3 bg-muted/30 space-y-1 text-sm">
                  {loadingRows ? (
                    <div className="text-muted-foreground text-xs">Loading delivery…</div>
                  ) : rows.length === 0 ? (
                    <div className="text-muted-foreground text-xs">No delivery records.</div>
                  ) : rows.map((r) => (
                    <div key={r.tenant_id} className="flex items-center justify-between text-xs">
                      <span className="truncate">{r.business_name}</span>
                      <span className="text-muted-foreground">{r.read_at ? `Read ${formatDistanceToNow(new Date(r.read_at), { addSuffix: true })}` : "Unread"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
