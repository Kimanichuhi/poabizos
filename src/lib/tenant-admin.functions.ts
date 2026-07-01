import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AppRole = "tenant_admin" | "manager" | "staff";

export const createTenantUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; password: string; full_name: string; role: AppRole }) => {
    if (!data.email || !data.password || !data.role) throw new Error("Missing fields");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    if (!["tenant_admin", "manager", "staff"].includes(data.role)) throw new Error("Invalid role");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Look up caller's tenant + verify tenant_admin
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    const tid = (profile as any)?.tenant_id as string | null;
    if (!tid) throw new Error("No tenant");
    const { data: isAdmin } = await supabase.rpc("has_tenant_role" as any, {
      _user_id: userId, _tenant_id: tid, _role: "tenant_admin",
    });
    if (!isAdmin) throw new Error("Forbidden: only tenant admins can create users");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create the auth user (auto-confirmed, no invite email)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Could not create user");
    }
    const newId = created.user.id;

    // Attach profile + role using admin client
    await supabaseAdmin.from("profiles").upsert({
      id: newId, email: data.email, full_name: data.full_name, tenant_id: tid, is_active: true,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: newId, role: data.role, tenant_id: tid });

    return { id: newId, email: data.email };
  });

export const resetTenantUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; new_password: string }) => {
    if (!data.user_id || !data.new_password) throw new Error("Missing fields");
    if (data.new_password.length < 8) throw new Error("Password must be at least 8 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
    const tid = (profile as any)?.tenant_id as string | null;
    if (!tid) throw new Error("No tenant");
    const { data: isAdmin } = await supabase.rpc("has_tenant_role" as any, {
      _user_id: userId, _tenant_id: tid, _role: "tenant_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    // Verify target user belongs to this tenant
    const { data: target } = await supabase.from("profiles").select("tenant_id").eq("id", data.user_id).maybeSingle();
    if ((target as any)?.tenant_id !== tid) throw new Error("User not in this workspace");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.new_password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
