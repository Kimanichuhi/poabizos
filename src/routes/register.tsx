import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register your business · PoaBiz OS" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const { refresh } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // 1. Create the user account
      const { data: signup, error: e1 } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: ownerName }, emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (e1) throw e1;
      // Ensure session is available (auto-confirm is on, so usually instant)
      if (!signup.session) {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signErr) throw signErr;
      }
      // 2. Create tenant + assign role
      const { error: e2 } = await supabase.rpc("register_tenant" as any, {
        _business_name: businessName,
        _business_type: businessType,
        _phone: phone,
        _email: email,
        _owner_name: ownerName,
      });
      if (e2) throw e2;
      await refresh();
      toast.success("Welcome! Your workspace is ready.");
      nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-lg p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground grid place-items-center mb-3"><Building2 className="h-5 w-5" /></div>
          <h1 className="text-xl font-semibold">Register your business</h1>
          <p className="text-sm text-muted-foreground mt-1">Set up your workspace in under a minute</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bn">Business name</Label>
              <Input id="bn" value={businessName} onChange={(e) => setBusinessName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bt">Business type</Label>
              <Input id="bt" placeholder="e.g. Retail, Salon" value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="on">Owner full name</Label>
            <Input id="on" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ph">Phone</Label>
              <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating workspace…" : "Create workspace"}</Button>
        </form>
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/auth" className="text-primary hover:underline">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
