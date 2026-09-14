import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  Truck,
  UserCog,
  ClipboardList,
  BarChart3,
  Plug,
  Sparkles,
  Layers,
  Check,
  UserPlus,
  Settings2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fmtMoney } from "@/lib/format";
import poaBizLogoUrl from "@/assets/PoaBiz OS.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoaBiz OS — Run your whole business" },
      {
        name: "description",
        content:
          "Sales, inventory, expenses, HR, payroll and more in one platform. Start your free 30-day trial — no credit card required.",
      },
    ],
  }),
  component: Landing,
});

interface FeatureRow {
  id: string;
  feature_key: string;
  feature_name: string;
  module: string | null;
}

const MODULE_ICON: Record<string, typeof LayoutDashboard> = {
  Core: LayoutDashboard,
  Sales: ShoppingCart,
  Inventory: Package,
  Finance: Wallet,
  CRM: Users,
  Procurement: Truck,
  HR: UserCog,
  Operations: ClipboardList,
  Reports: BarChart3,
  Integrations: Plug,
  AI: Sparkles,
};

function useHomepageData() {
  return useQuery({
    queryKey: ["homepage-data"],
    queryFn: async () => {
      const [featuresRes, cheapestPackageRes] = await Promise.all([
        supabase
          .from("features")
          .select("id, feature_key, feature_name, module")
          .order("module")
          .order("feature_name"),
        supabase
          .from("subscription_packages")
          .select("monthly_price")
          .eq("is_active", true)
          .order("sort_order")
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        features: (featuresRes.data ?? []) as FeatureRow[],
        startingPrice: cheapestPackageRes.data?.monthly_price ?? null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

const STEPS = [
  {
    icon: UserPlus,
    title: "Start your free trial",
    desc: "Register your business in under a minute — 30 days free, no credit card required.",
  },
  {
    icon: Settings2,
    title: "Set up your business",
    desc: "Add products, staff and branches. Bring in your sales, inventory and expenses.",
  },
  {
    icon: TrendingUp,
    title: "Run and grow",
    desc: "Track performance with reports, automate the busywork, and add features as you scale.",
  },
];

function Landing() {
  const { data, isLoading } = useHomepageData();

  const byModule = useMemo(() => {
    const map = new Map<string, FeatureRow[]>();
    for (const f of data?.features ?? []) {
      const key = f.module ?? "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return map;
  }, [data]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center flex flex-col items-center">
        <img src={poaBizLogoUrl} alt="PoaBiz OS" className="h-32 sm:h-40 w-auto" />
        <p className="text-muted-foreground mt-6 text-lg max-w-xl">
          One platform for sales, inventory, expenses, HR, payroll and more — everything a growing
          business needs to run smoothly.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
          <Link to="/register">
            <Button size="lg">Start free trial</Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          No credit card required · Free for 30 days
          {data?.startingPrice != null && (
            <> · plans from {fmtMoney(data.startingPrice)}/mo after</>
          )}
        </p>
      </section>

      {/* Feature highlights */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything you need, in one place
          </h2>
          <p className="text-muted-foreground mt-2">
            No add-ons to hunt down — it's all built in and ready to switch on.
          </p>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-6 h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...byModule.entries()].map(([module, list]) => {
              const Icon = MODULE_ICON[module] ?? Layers;
              return (
                <Card key={module} className="p-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-semibold">{module}</div>
                  <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                    {list.slice(0, 5).map((f) => (
                      <li key={f.id} className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{f.feature_name}</span>
                      </li>
                    ))}
                    {list.length > 5 && <li className="text-xs">+ {list.length - 5} more</li>}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-card border-y">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-center mb-10">
            Up and running in three steps
          </h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground grid place-items-center mb-4 font-semibold">
                  {i + 1}
                </div>
                <s.icon className="h-5 w-5 text-primary mb-2" />
                <div className="font-medium">{s.title}</div>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Ready to run your business better?
        </h2>
        <p className="text-muted-foreground mt-2">
          Start your free 30-day trial today — no credit card required.
        </p>
        <div className="mt-6">
          <Link to="/register">
            <Button size="lg">Start free trial</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground space-y-1">
        <div>
          © {new Date().getFullYear()} PoaBiz OS ·{" "}
          <Link to="/platform-setup" className="hover:underline">
            Platform setup
          </Link>
        </div>
        <div>
          Created by{" "}
          <a
            href="https://qeemlabs.co.ke"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            Qeem Labs Ltd.
          </a>
        </div>
      </footer>
    </div>
  );
}
