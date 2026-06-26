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
export interface PackageInfo {
  id: string;
  package_code: string;
  package_name: string;
  monthly_price: number;
  user_limit: number | null;
  description: string | null;
}

interface PackageFeatureRow {
  package_code: string;
  package_name: string;
  feature_key: string;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  roles: AppRole[];
  features: string[];
  packageInfo: PackageInfo | null;
  loading: boolean;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  hasRole: (r: AppRole) => boolean;
  hasFeature: (key: string) => boolean;
  /** Returns the cheapest package that includes the given feature key. */
  packageForFeature: (key: string) => { code: string; name: string; price: number } | null;
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
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [allPackageFeatures, setAllPackageFeatures] = useState<PackageFeatureRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async (uid: string | null) => {
    if (!uid) {
      setProfile(null); setTenant(null); setRoles([]); setFeatures([]); setPackageInfo(null);
      return;
    }
    const s = supabase as any;
    const { data: prof } = await s.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile(prof as Profile | null);

    const { data: roleRows } = await s.from("user_roles").select("role").eq("user_id", uid);
    const userRoles = (roleRows ?? []).map((r: any) => r.role as AppRole);
    setRoles(userRoles);

    let t: Tenant | null = null;
    let feats: string[] = [];
    let pkg: PackageInfo | null = null;
    if (prof?.tenant_id) {
      const { data: ten } = await s.from("tenants").select("*").eq("id", prof.tenant_id).maybeSingle();
      t = (ten as Tenant) ?? null;

      // Active subscription → package details
      const { data: sub } = await s
        .from("tenant_subscriptions")
        .select("package:subscription_packages(*)")
        .eq("tenant_id", prof.tenant_id)
        .in("status", ["active", "trial"])
        .maybeSingle();
      const p = sub?.package;
      if (p) {
        pkg = {
          id: p.id, package_code: p.package_code, package_name: p.package_name,
          monthly_price: Number(p.monthly_price), user_limit: p.user_limit, description: p.description,
        };
      } else if (t) {
        // fallback to legacy tenants.subscription_plan
        const { data: legacy } = await s.from("subscription_packages").select("*").eq("package_code", t.subscription_plan).maybeSingle();
        if (legacy) pkg = {
          id: legacy.id, package_code: legacy.package_code, package_name: legacy.package_name,
          monthly_price: Number(legacy.monthly_price), user_limit: legacy.user_limit, description: legacy.description,
        };
      }

      const { data: gf } = await s.rpc("get_tenant_features", { _tenant_id: prof.tenant_id });
      feats = (gf ?? []).map((x: any) => x.feature_key);
    }

    // Lookup: all package→feature mappings so we can tell which package unlocks a feature
    const { data: pfAll } = await s
      .from("package_features")
      .select("package:subscription_packages(package_code, package_name, sort_order), feature:features(feature_key)");
    const flat: PackageFeatureRow[] = (pfAll ?? [])
      .filter((r: any) => r.package && r.feature)
      .map((r: any) => ({ package_code: r.package.package_code, package_name: r.package.package_name, feature_key: r.feature.feature_key }));
    setAllPackageFeatures(flat);

    setTenant(t);
    setFeatures(feats);
    setPackageInfo(pkg);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    await loadAll(data.user?.id ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null); setProfile(null); setTenant(null); setRoles([]); setFeatures([]); setPackageInfo(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        const u = session?.user ?? null;
        setUser(u);
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

  const value = useMemo<AuthCtx>(() => {
    const order = ["starter", "growth", "business", "premium"];
    return {
      user, profile, tenant, roles, features, packageInfo, loading,
      isPlatformAdmin: roles.includes("platform_super_admin"),
      isTenantAdmin: roles.includes("tenant_admin"),
      hasRole: (r) => roles.includes(r),
      hasFeature: (k) => features.includes(k),
      packageForFeature: (k) => {
        const matches = allPackageFeatures.filter(r => r.feature_key === k);
        if (matches.length === 0) return null;
        matches.sort((a, b) => order.indexOf(a.package_code) - order.indexOf(b.package_code));
        const m = matches[0];
        return { code: m.package_code, name: m.package_name, price: 0 };
      },
      refresh,
      signOut: async () => { await supabase.auth.signOut(); },
    };
  }, [user, profile, tenant, roles, features, packageInfo, allPackageFeatures, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
