import { Link, useRouterState } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Menu, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  to: string;
  label: string;
  icon: any;
  feature?: string;
  anyFeature?: string[];
}

interface Props {
  visibleNav: NavItem[];
  adminNav: NavItem[];
  showPlatform: boolean;
}

export function MobileNav({ visibleNav, adminNav, showPlatform }: Props) {
  const [open, setOpen] = useState(false);
  const { tenant } = useAuth();
  const pathname = useRouterState({ select: s => s.location.pathname });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-72 flex flex-col bg-sidebar text-sidebar-foreground">
        <SheetHeader className="px-5 py-4 border-b border-sidebar-border text-left">
          <SheetTitle className="text-sidebar-foreground text-base truncate">
            {tenant?.business_name ?? "Workspace"}
          </SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="border-sidebar-border text-sidebar-foreground/80 capitalize text-[10px]">
              {tenant?.subscription_plan ?? "—"} plan
            </Badge>
            {tenant?.subscription_status === "suspended" && (
              <Badge variant="destructive" className="text-[10px]">Suspended</Badge>
            )}
          </div>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 text-sm">
          {visibleNav.map(i => {
            const active = pathname === i.to || (i.to !== "/dashboard" && pathname.startsWith(i.to));
            const Icon = i.icon;
            return (
              <Link
                key={i.to} to={i.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}
              >
                <Icon className="h-4 w-4 opacity-80 shrink-0" />
                <span className="truncate">{i.label}</span>
              </Link>
            );
          })}
          {adminNav.length > 0 && (
            <div className="pt-4 mt-3 border-t border-sidebar-border space-y-0.5">
              <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Admin</div>
              {adminNav.map(i => {
                const active = pathname.startsWith(i.to);
                const Icon = i.icon;
                return (
                  <Link
                    key={i.to} to={i.to} onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}
                  >
                    <Icon className="h-4 w-4 opacity-80 shrink-0" />
                    <span className="truncate">{i.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
          {showPlatform && (
            <div className="pt-4 mt-3 border-t border-sidebar-border">
              <Link
                to="/platform" onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-sidebar-accent/60"
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="truncate">Platform Console</span>
              </Link>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
