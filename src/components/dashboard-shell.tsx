import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, ShoppingCart, Wallet, Users, BarChart3, Package, HandCoins,
  Truck, FileBarChart, UserCog, Banknote, Building2, ListChecks, Smartphone,
  MessageSquare, Bot, GitBranch, Shield, ScrollText, LogOut, ChevronDown, CreditCard, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { PoaBizLogo } from "@/components/poabiz-logo";

interface NavItem { to: string; label: string; icon: any; feature?: string; anyFeature?: string[]; adminOnly?: boolean; }

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/dashboard/sales", label: "Sales", icon: ShoppingCart, feature: "sales" },
  { to: "/dashboard/inventory", label: "Products", icon: Package, anyFeature: ["products", "inventory", "inventory_basic"] },
  { to: "/dashboard/expenses", label: "Expenses", icon: Wallet, feature: "expenses" },
  { to: "/dashboard/customers", label: "Customers", icon: Users, feature: "customers" },
  { to: "/dashboard/reports", label: "Reports", icon: BarChart3, feature: "reports" },
  { to: "/dashboard/debtors", label: "Debtors", icon: HandCoins, feature: "debtors" },
  { to: "/dashboard/suppliers", label: "Suppliers", icon: Truck, feature: "suppliers" },
  { to: "/dashboard/stock-reports", label: "Stock Reports", icon: FileBarChart, feature: "stock_reports" },
  { to: "/dashboard/hr", label: "Employees", icon: UserCog, feature: "hr" },
  { to: "/dashboard/payroll", label: "Payroll", icon: Banknote, feature: "payroll" },
  { to: "/dashboard/assets", label: "Assets", icon: Building2, feature: "assets" },
  { to: "/dashboard/tasks", label: "Tasks", icon: ListChecks, feature: "tasks" },
  { to: "/dashboard/mpesa", label: "M-Pesa", icon: Smartphone, feature: "mpesa" },
  { to: "/dashboard/sms", label: "SMS", icon: MessageSquare, feature: "sms" },
  { to: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageSquare, feature: "whatsapp" },
  { to: "/dashboard/ai-assistant", label: "AI Assistant", icon: Bot, feature: "ai_assistant" },
  { to: "/dashboard/branches", label: "Branches", icon: GitBranch, feature: "multi_branch" },
  { to: "/dashboard/subscription", label: "Subscription", icon: CreditCard },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/dashboard/users", label: "Users & Roles", icon: Shield, adminOnly: true },
  { to: "/dashboard/settings", label: "Settings", icon: Settings, adminOnly: true },
  { to: "/dashboard/audit-logs", label: "Audit Logs", icon: ScrollText, adminOnly: true },
];

export function DashboardShell() {
  const { tenant, user, profile, hasFeature, isTenantAdmin, isPlatformAdmin, signOut } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [open, setOpen] = useState(false);

  const visibleNav = NAV.filter(i => {
    if (isPlatformAdmin) return true;
    if (i.feature) return hasFeature(i.feature);
    if (i.anyFeature) return i.anyFeature.some(f => hasFeature(f));
    return true;
  });
  const visibleAdminNav = (isTenantAdmin || isPlatformAdmin) ? ADMIN_NAV : [];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
            ) : (
              <PoaBizLogo className="h-8 w-8" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{tenant?.business_name ?? "Workspace"}</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground/80 capitalize text-[10px]">
                  {tenant?.subscription_plan ?? "—"} plan
                </Badge>
                {tenant?.subscription_status === "suspended" && (
                  <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 text-sm">
          {visibleNav.map(i => {
            const active = pathname === i.to || (i.to !== "/dashboard" && pathname.startsWith(i.to));
            const Icon = i.icon;
            return (
              <Link key={i.to} to={i.to} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}>
                <Icon className="h-4 w-4 opacity-80 shrink-0" /> <span className="truncate">{i.label}</span>
              </Link>
            );
          })}
          {visibleAdminNav.length > 0 && (
            <div className="pt-4 mt-3 border-t border-sidebar-border space-y-0.5">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Admin</div>
              {visibleAdminNav.map(i => {
                const active = pathname.startsWith(i.to);
                const Icon = i.icon;
                return (
                  <Link key={i.to} to={i.to} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}>
                    <Icon className="h-4 w-4 opacity-80 shrink-0" /> <span className="truncate">{i.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {isPlatformAdmin && (
            <div className="pt-4 mt-3 border-t border-sidebar-border">
              <Link to="/platform" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/60">
                <Shield className="h-4 w-4" /> Platform Console
              </Link>
            </div>
          )}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-card flex items-center gap-2 justify-between px-3 md:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <MobileNav visibleNav={visibleNav} adminNav={visibleAdminNav} showPlatform={isPlatformAdmin} />
            {tenant?.logo_url && <img src={tenant.logo_url} alt="" className="h-7 w-7 rounded object-cover md:hidden shrink-0" />}
            <div className="md:hidden font-semibold truncate text-sm">{tenant?.business_name}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
          <div className="relative shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)} className="gap-2 px-2">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                {(profile?.full_name || user?.email || "?").slice(0,1).toUpperCase()}
              </div>
              <span className="hidden sm:inline text-sm max-w-[160px] truncate">{profile?.full_name || user?.email}</span>
              <ChevronDown className="h-3 w-3 hidden sm:block" />
            </Button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-md shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b">
                  <div className="text-sm font-medium truncate">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                </div>
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                  onClick={async () => { await signOut(); nav({ to: "/auth" }); }}
                ><LogOut className="h-4 w-4" /> Sign out</button>
              </div>
            )}
          </div>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
