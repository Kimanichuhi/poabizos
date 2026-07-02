import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { applyTenantTheme } from "@/lib/apply-tenant-theme";
import { Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: () => <RoleGuard roles={["tenant_admin", "platform_super_admin"]}><SettingsPage /></RoleGuard>,
});

const THEME_PRESETS: { label: string; primary: string; accent: string }[] = [
  { label: "Emerald", primary: "142 71% 45%", accent: "142 60% 96%" },
  { label: "Blue",    primary: "217 91% 60%", accent: "213 100% 96%" },
  { label: "Violet",  primary: "262 83% 58%", accent: "270 95% 96%" },
  { label: "Orange",  primary: "24 95% 53%",  accent: "33 100% 96%" },
  { label: "Rose",    primary: "347 77% 50%", accent: "355 100% 97%" },
  { label: "Slate",   primary: "215 25% 27%", accent: "210 40% 96%" },
];

const CURRENCIES = ["KES", "USD", "EUR", "GBP", "UGX", "TZS", "NGN", "ZAR"];

function SettingsPage() {
  const { tenant, refresh } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (tenant) setForm({
      business_name: tenant.business_name ?? "",
      email: tenant.email ?? "",
      phone: tenant.phone ?? "",
      logo_url: (tenant as any).logo_url ?? "",
      theme_primary: (tenant as any).theme_primary ?? "",
      theme_accent: (tenant as any).theme_accent ?? "",
      theme_mode: (tenant as any).theme_mode ?? "system",
      currency: (tenant as any).currency ?? "KES",
      timezone: (tenant as any).timezone ?? "Africa/Nairobi",
      locale: (tenant as any).locale ?? "en",
    });
  }, [tenant]);

  // Live preview theme while editing
  useEffect(() => {
    if (form.theme_primary || form.theme_accent || form.theme_mode) {
      applyTenantTheme({ theme_primary: form.theme_primary, theme_accent: form.theme_accent, theme_mode: form.theme_mode });
    }
  }, [form.theme_primary, form.theme_accent, form.theme_mode]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("update_tenant_settings", { _payload: form });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Settings saved");
      await refresh();
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const uploadLogo = async (file: File) => {
    if (!tenant?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${tenant.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("tenant-branding").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("tenant-branding").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed?.signedUrl) set("logo_url", signed.signedUrl);
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Customize your business identity, currency and app theme.</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-base">Business identity</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Business name</Label><Input className="mt-1.5" value={form.business_name ?? ""} onChange={e => set("business_name", e.target.value)} /></div>
          <div><Label>Contact email</Label><Input className="mt-1.5" type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} /></div>
          <div><Label>Phone</Label><Input className="mt-1.5" value={form.phone ?? ""} onChange={e => set("phone", e.target.value)} /></div>
          <div>
            <Label>Logo</Label>
            <div className="flex items-center gap-3 mt-1.5">
              {form.logo_url ? (
                <div className="relative">
                  <img src={form.logo_url} alt="logo" className="h-14 w-14 rounded object-cover border" />
                  <button type="button" onClick={() => set("logo_url", "")} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="h-3 w-3" /></button>
                </div>
              ) : <div className="h-14 w-14 rounded border bg-muted grid place-items-center text-xs text-muted-foreground">Logo</div>}
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                <div className={`inline-flex items-center gap-2 h-9 px-3 rounded-md border bg-background text-sm hover:bg-accent ${uploading ? "opacity-50" : ""}`}>
                  <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload logo"}
                </div>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-base">Localization</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>Currency</Label>
            <select className="mt-1.5 w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.currency ?? "KES"} onChange={e => set("currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Timezone</Label><Input className="mt-1.5" value={form.timezone ?? ""} onChange={e => set("timezone", e.target.value)} /></div>
          <div>
            <Label>Language</Label>
            <select className="mt-1.5 w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.locale ?? "en"} onChange={e => set("locale", e.target.value)}>
              <option value="en">English</option><option value="sw">Swahili</option><option value="fr">French</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="font-semibold text-base">Appearance</h2>
        <div>
          <Label className="text-xs uppercase text-muted-foreground">Color preset</Label>
          <div className="flex gap-2 flex-wrap mt-2">
            {THEME_PRESETS.map(p => (
              <button key={p.label} type="button" onClick={() => setForm((f: any) => ({ ...f, theme_primary: p.primary, theme_accent: p.accent }))}
                className={`px-3 py-1.5 rounded-md border text-xs flex items-center gap-2 ${form.theme_primary === p.primary ? "ring-2 ring-primary" : ""}`}>
                <span className="h-4 w-4 rounded-full" style={{ background: `hsl(${p.primary})` }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>Primary HSL (H S% L%)</Label><Input className="mt-1.5" value={form.theme_primary ?? ""} onChange={e => set("theme_primary", e.target.value)} placeholder="142 71% 45%" /></div>
          <div><Label>Accent HSL</Label><Input className="mt-1.5" value={form.theme_accent ?? ""} onChange={e => set("theme_accent", e.target.value)} placeholder="142 60% 96%" /></div>
          <div>
            <Label>Theme mode</Label>
            <select className="mt-1.5 w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.theme_mode ?? "system"} onChange={e => set("theme_mode", e.target.value)}>
              <option value="system">Match device</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-3 sm:-mx-4 md:-mx-6 mt-6 px-3 sm:px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-t flex justify-end gap-2 z-20">
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="lg">{save.isPending ? "Saving…" : "Save settings"}</Button>
      </div>
    </div>
  );
}
