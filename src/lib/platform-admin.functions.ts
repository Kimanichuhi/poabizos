import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requirePlatformAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_platform_admin", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

// ---------- Packages ----------
export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s: any = context.supabase;
    await requirePlatformAdmin(s, context.userId);
    const { data: packages, error } = await s
      .from("subscription_packages")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const { data: features } = await s.from("features").select("id, feature_key, feature_name").order("feature_key");
    const { data: pf } = await s.from("package_features").select("package_id, feature_id");
    return { packages: packages ?? [], features: features ?? [], packageFeatures: pf ?? [] };
  });

export const savePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as Record<string, unknown>)
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { data: id, error } = await s.rpc("admin_upsert_package", { _payload: data });
    if (error) throw new Error(error.message);
    return { id };
  });

export const setPackageFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { packageId: string; featureKeys: string[] };
    if (!x?.packageId || !Array.isArray(x.featureKeys)) throw new Error("bad input");
    return x;
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.rpc("admin_set_package_features", {
      _package_id: data.packageId,
      _feature_keys: data.featureKeys,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Subscriptions ----------
export const listTenantSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s: any = context.supabase;
    await requirePlatformAdmin(s, context.userId);
    const { data, error } = await s
      .from("tenants")
      .select("id, business_name, subscription_plan, subscription_status, email, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenants: data ?? [] };
  });

export const changeTenantPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { tenantId: string; packageCode: string };
    if (!x?.tenantId || !x?.packageCode) throw new Error("bad input");
    return x;
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.rpc("admin_change_tenant_package", {
      _tenant_id: data.tenantId,
      _package_code: data.packageCode,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { tenantId: string; status: string };
    if (!x?.tenantId || !x?.status) throw new Error("bad input");
    return x;
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.rpc("admin_set_tenant_status", {
      _tenant_id: data.tenantId,
      _status: data.status,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- UI content ----------
export const listUiContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s: any = context.supabase;
    await requirePlatformAdmin(s, context.userId);
    const { data, error } = await s.from("ui_content").select("*").order("key");
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const saveUiContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { key: string; value: unknown; broadcast?: boolean };
    if (!x?.key) throw new Error("bad input");
    return { key: x.key, value: x.value, broadcast: !!x.broadcast };
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.rpc("admin_upsert_ui_content", {
      _key: data.key,
      _value: data.value,
      _broadcast: data.broadcast,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
