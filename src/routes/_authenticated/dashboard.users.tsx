import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useState } from "react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard/users")({
  component: () => <RoleGuard roles={["tenant_admin","platform_super_admin"]}><UsersPage /></RoleGuard>,
});

function UsersPage() {
  const { tenant } = useAuth();
  const tid = tenant?.id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"tenant_admin"|"manager"|"staff">("staff");

  const { data: rows = [] } = useQuery({
    queryKey: ["tenant-users", tid],
    enabled: !!tid,
    queryFn: async () => {
      const { data: profiles } = await (supabase as any).from("profiles").select("*").eq("tenant_id", tid);
      const ids = (profiles ?? []).map((p: any) => p.id);
      let roles: any[] = [];
      if (ids.length) {
        const { data } = await (supabase as any).from("user_roles").select("*").in("user_id", ids).eq("tenant_id", tid);
        roles = data ?? [];
      }
      return (profiles ?? []).map((p: any) => ({ ...p, roles: roles.filter(r => r.user_id === p.id).map(r => r.role) }));
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("add_user_to_tenant" as any, { _email: email, _role: role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("User added"); qc.invalidateQueries({ queryKey: ["tenant-users", tid] }); setOpen(false); setEmail(""); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("profiles").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["tenant-users", tid] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users & Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Invite team members and assign roles within this workspace.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Invite user</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{u.roles.length ? u.roles.map((r: string) => <Badge key={r} variant="secondary">{r}</Badge>) : <span className="text-muted-foreground">—</span>}</div></td>
                <td className="px-4 py-3">{u.is_active ? <Badge>Active</Badge> : <Badge variant="destructive">Disabled</Badge>}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}>{u.is_active ? "Disable" : "Enable"}</Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No team members yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite user</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">The user must already have an account (ask them to sign up first), then enter their email here to attach them to this workspace.</p>
          <div className="space-y-3 mt-3">
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select value={role} onChange={e => setRole(e.target.value as any)} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
                <option value="tenant_admin">Tenant Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={add.isPending} onClick={() => add.mutate()}>{add.isPending ? "Adding…" : "Add user"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
