import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "platform_super_admin" | "tenant_admin" | "manager" | "staff";
export type Plan = "starter" | "growth" | "business" | "premium";
export type SubStatus = "trial" | "active" | "suspended" | "cancelled";

export interface Profile {
  id: string;
  tenant_id: string | null;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
}
export interface Tenant {
  id: string;
  business_name: string;
  business_type: string | null;
  subscription_plan: Plan;
  subscription_status: SubStatus;
  email: string | null;
  phone: string | null;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  roles: AppRole[];
  features: string[];
  loading: boolean;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  hasFeature: (key: string) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async (uid: string | null) => {
    if (!uid) {
      setProfile(null); setTenant(null); setRoles([]); setFeatures([]);
      return;
    }
    const { data: prof } = await (supabase as any).from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(prof as Profile | null);

    const { data: roleRows } = await (supabase as any).from("user_roles").select("role").eq("user_id", uid);
    const userRoles = (roleRows ?? []).map((r: any) => r.role as AppRole);
    setRoles(userRoles);

    let t: Tenant | null = null;
    let feats: string[] = [];
    if (prof?.tenant_id) {
      const { data: ten } = await (supabase as any).from("tenants").select("*").eq("id", prof.tenant_id).maybeSingle();
      t = (ten as Tenant) ?? null;
      if (t) {
        const { data: pf } = await (supabase as any).from("plan_features").select("feature_key").eq("plan_name", t.subscription_plan);
        feats = (pf ?? []).map((x: any) => x.feature_key);
      }
    }
    setTenant(t);
    setFeatures(feats);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    await loadAll(data.user?.id ?? null);
  };

  useEffect(() => {
    // First subscribe, then check existing session
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null); setProfile(null); setTenant(null); setRoles([]); setFeatures([]);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        const u = session?.user ?? null;
        setUser(u);
        // Defer to avoid deadlock
        setTimeout(() => { loadAll(u?.id ?? null); }, 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      loadAll(u?.id ?? null).finally(() => setLoading(false));
    });

    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, profile, tenant, roles, features, loading,
    isPlatformAdmin: roles.includes("platform_super_admin"),
    isTenantAdmin: roles.includes("tenant_admin"),
    hasRole: (r) => roles.includes(r),
    hasFeature: (k) => features.includes(k),
    refresh,
    signOut: async () => { await supabase.auth.signOut(); },
  }), [user, profile, tenant, roles, features, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
