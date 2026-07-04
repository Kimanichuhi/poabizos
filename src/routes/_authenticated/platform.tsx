import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ShieldCheck, LayoutDashboard, Building, Users, LogOut, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform")({
  head: () => ({ meta: [{ title: "Platform · PoaBiz OS" }] }),
  component: PlatformLayout,
});

function PlatformLayout() {
  const { isPlatformAdmin, loading, user, signOut } = useAuth();
  const nav = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!isPlatformAdmin) return (
    <div className="min-h-screen grid place-items-center p-4 text-center">
      <div>
        <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <h2 className="font-semibold">Platform admin only</h2>
        <p className="text-muted-foreground text-sm mt-2">You don't have permission to view this console.</p>
        <Link to="/dashboard"><Button variant="outline" className="mt-4">Go to dashboard</Button></Link>
      </div>
    </div>
  );

  const items = [
    { to: "/platform", label: "Overview", icon: LayoutDashboard },
    { to: "/platform/tenants", label: "Tenants", icon: Building },
    { to: "/platform/requests", label: "Registration Requests", icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold text-sm">Platform Console</div>
            <div className="text-xs text-sidebar-foreground/70">Super admin</div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 text-sm">
          {items.map(i => {
            const active = pathname === i.to || (i.to !== "/platform" && pathname.startsWith(i.to));
            const Icon = i.icon;
            return (
              <Link key={i.to} to={i.to} className={`flex items-center gap-3 px-3 py-2 rounded-md ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}>
                <Icon className="h-4 w-4" /> {i.label}
              </Link>
            );
          })}
          <div className="pt-4 mt-3 border-t border-sidebar-border">
            <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent/60"><ArrowLeft className="h-4 w-4" /> Workspace view</Link>
          </div>
        </nav>
        <div className="p-3 border-t border-sidebar-border text-xs">
          <div className="text-sidebar-foreground/70 truncate">{user?.email}</div>
          <Button variant="ghost" size="sm" className="mt-2 text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start" onClick={async () => { await signOut(); nav({ to: "/auth" }); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-6 overflow-x-hidden"><Outlet /></main>
    </div>
  );
}
