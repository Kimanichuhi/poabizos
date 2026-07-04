import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/platform-setup")({
  head: () => ({ meta: [{ title: "Platform setup · PoaBiz OS" }] }),
  component: PlatformSetup,
});

function PlatformSetup() {
  const { user, isPlatformAdmin, refresh, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const { count } = await (supabase as any).from("user_roles").select("id", { count: "exact", head: true }).eq("role", "platform_super_admin");
      setExists((count ?? 0) > 0);
    })();
  }, []);

  const bootstrap = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("bootstrap_super_admin" as any);
      if (error) throw error;
      if (data === true) {
        toast.success("You are now the platform super admin");
        await refresh();
        nav({ to: "/platform" });
      } else {
        toast.error("A super admin already exists");
        setExists(true);
      }
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
      <Card className="max-w-md w-full p-6 text-center">
        <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center mx-auto mb-3"><ShieldCheck className="h-5 w-5" /></div>
        <h1 className="text-xl font-semibold">Platform setup</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Claim the platform super admin role. This is only available until the first super admin is created.
        </p>
        {loading ? null : !user ? (
          <div className="mt-6 space-y-2">
            <p className="text-sm">You need an account first.</p>
            <Link to="/auth"><Button>Sign in / Sign up</Button></Link>
          </div>
        ) : isPlatformAdmin ? (
          <div className="mt-6"><Link to="/platform"><Button>Open platform console</Button></Link></div>
        ) : exists ? (
          <p className="mt-6 text-sm text-destructive">A super admin already exists. Contact them for access.</p>
        ) : (
          <Button className="mt-6 w-full" disabled={busy} onClick={bootstrap}>{busy ? "Setting up…" : "Become platform super admin"}</Button>
        )}
      </Card>
    </div>
  );
}
