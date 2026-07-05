import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listUiContent, saveUiContent } from "@/lib/platform-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/platform/ui-content")({
  head: () => ({ meta: [{ title: "UI Content · Platform · PoaBiz OS" }] }),
  component: UiContentAdmin,
});

type Row = { key: string; value: unknown; updated_at: string };

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
        <h1 className="text-2xl font-semibold tracking-tight">UI Content</h1>
        <p className="text-sm text-muted-foreground">Edit landing page copy and announcements. Tick "Broadcast" to notify every workspace when you save.</p>
      </div>

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
                Broadcast as announcement to all workspaces
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
    </div>
  );
}
