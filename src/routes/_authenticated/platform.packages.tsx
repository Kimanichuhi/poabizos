import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPackages, savePackage, setPackageFeatures } from "@/lib/platform-admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/platform/packages")({
  head: () => ({ meta: [{ title: "Packages · Platform · PoaBiz OS" }] }),
  component: PackagesAdmin,
});

type Pkg = { id: string; package_code: string; package_name: string; monthly_price: number; user_limit: number | null; description: string | null; is_active: boolean; sort_order: number };
type Feat = { id: string; feature_key: string; feature_name: string };

function PackagesAdmin() {
  const list = useServerFn(listPackages);
  const save = useServerFn(savePackage);
  const setFeats = useServerFn(setPackageFeatures);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-packages"], queryFn: () => list() });

  const [editing, setEditing] = useState<Partial<Pkg> | null>(null);
  const [featOpen, setFeatOpen] = useState<Pkg | null>(null);
  const [busy, setBusy] = useState(false);

  const submitPkg = async () => {
    if (!editing?.package_code || !editing?.package_name) { toast.error("Code and name are required"); return; }
    setBusy(true);
    try {
      await save({ data: editing as any });
      toast.success("Package saved");
      setEditing(null);
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  const initialFeatureKeys = (pkg: Pkg): string[] => {
    const fIds = (data?.packageFeatures ?? []).filter((r: any) => r.package_id === pkg.id).map((r: any) => r.feature_id);
    return (data?.features ?? []).filter((f: Feat) => fIds.includes(f.id)).map((f: Feat) => f.feature_key);
  };

  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const openFeatures = (pkg: Pkg) => { setSelectedKeys(initialFeatureKeys(pkg)); setFeatOpen(pkg); };

  const submitFeats = async () => {
    if (!featOpen) return;
    setBusy(true);
    try {
      await setFeats({ data: { packageId: featOpen.id, featureKeys: selectedKeys } });
      toast.success("Features updated. Tenants on this package have been notified.");
      setFeatOpen(null);
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Packages</h1>
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ is_active: true, sort_order: 100 })}><Plus className="h-4 w-4 mr-1" /> New package</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing?.id ? "Edit package" : "New package"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Code</Label><Input value={editing?.package_code ?? ""} onChange={(e) => setEditing({ ...editing!, package_code: e.target.value })} placeholder="starter" /></div>
              <div><Label>Name</Label><Input value={editing?.package_name ?? ""} onChange={(e) => setEditing({ ...editing!, package_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Monthly price</Label><Input type="number" value={editing?.monthly_price ?? 0} onChange={(e) => setEditing({ ...editing!, monthly_price: Number(e.target.value) })} /></div>
                <div><Label>User limit</Label><Input type="number" value={editing?.user_limit ?? ""} onChange={(e) => setEditing({ ...editing!, user_limit: e.target.value ? Number(e.target.value) : null })} placeholder="unlimited" /></div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing?.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing!, is_active: v })} /> <Label>Active</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={submitPkg} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      <div className="grid gap-3">
        {(data?.packages ?? []).map((p: Pkg) => (
          <Card key={p.id} className="p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.package_name}</span>
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{p.package_code}</span>
                {!p.is_active && <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">inactive</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{p.description || "—"}</div>
              <div className="text-xs mt-1">Price: {p.monthly_price} · Users: {p.user_limit ?? "unlimited"} · Features: {initialFeatureKeys(p).length}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openFeatures(p)}>Features</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(p)}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!featOpen} onOpenChange={(o) => !o && setFeatOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Features · {featOpen?.package_name}</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {(data?.features ?? []).map((f: Feat) => {
              const checked = selectedKeys.includes(f.feature_key);
              return (
                <label key={f.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => {
                      setSelectedKeys((keys) => v ? [...new Set([...keys, f.feature_key])] : keys.filter((k) => k !== f.feature_key));
                    }}
                  />
                  <span>{f.feature_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{f.feature_key}</span>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatOpen(null)}>Cancel</Button>
            <Button onClick={submitFeats} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save features</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
