import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · PoaBiz OS" }] }),
  component: DashboardGate,
});

function DashboardGate() {
  const { loading, profile } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && profile && !profile.tenant_id) {
      // user has no workspace yet — send to register
    }
  }, [loading, profile, nav]);

  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (profile && !profile.tenant_id) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <Card className="max-w-md p-6 text-center">
          <h2 className="font-semibold">No workspace yet</h2>
          <p className="text-sm text-muted-foreground mt-2">Register a business to get started, or ask your admin to invite you.</p>
          <div className="mt-4 flex gap-2 justify-center">
            <Link to="/register"><Button>Register business</Button></Link>
            <Button variant="outline" onClick={async () => { const { supabase } = await import("@/integrations/supabase/client"); await supabase.auth.signOut(); nav({ to: "/auth" }); }}>Sign out</Button>
          </div>
        </Card>
      </div>
    );
  }
  return <DashboardShell />;
}
