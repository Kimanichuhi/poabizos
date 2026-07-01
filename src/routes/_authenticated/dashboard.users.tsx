import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
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
import { createTenantUser, resetTenantUserPassword } from "@/lib/tenant-admin.functions";
import { KeyRound, UserPlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/users")({
  component: () => <RoleGuard roles={["tenant_admin","platform_super_admin"]}><UsersPage /></RoleGuard>,
});

function UsersPage() {
  const { tenant, user: me } = useAuth();
  const tid = tenant?.id;
  const qc = useQueryClient();
  const createUserFn = useServerFn(createTenantUser);
  const resetPwFn = useServerFn(resetTenantUserPassword);

  const [addOpen, setAddOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "staff" as "tenant_admin" | "manager" | "staff" });
  const [newPw, setNewPw] = useState("");

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

  const create = useMutation({
    mutationFn: async () => {
      await createUserFn({ data: form });
    },
    onSuccess: () => {
      toast.success("User created");
      qc.invalidateQueries({ queryKey: ["tenant-users", tid] });
      setAddOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "staff" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const changeRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { error } = await (supabase as any).rpc("change_tenant_user_role", { _user_id: user_id, _new_role: role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["tenant-users", tid] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("remove_tenant_user", { _user_id: id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("User removed"); qc.invalidateQueries({ queryKey: ["tenant-users", tid] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const resetPw = useMutation({
    mutationFn: async () => {
      if (!pwOpen) return;
      await resetPwFn({ data: { user_id: pwOpen.id, new_password: newPw } });
    },
    onSuccess: () => { toast.success("Password reset"); setPwOpen(null); setNewPw(""); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await (supabase as any).from("profiles").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-users", tid] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users & Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">Create team accounts with roles. Only admins can add employees to HR.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2"><UserPlus className="h-4 w-4" /> Create user</Button>
      </div>

      {/* Table on md+, cards on mobile */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u: any) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <select disabled={u.id === me?.id} value={u.roles[0] ?? "staff"} onChange={e => changeRole.mutate({ user_id: u.id, role: e.target.value })}
                    className="h-8 px-2 rounded-md border bg-background text-xs">
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">{u.is_active ? <Badge>Active</Badge> : <Badge variant="destructive">Disabled</Badge>}</td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(u.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Reset password" onClick={() => { setPwOpen({ id: u.id, name: u.full_name ?? u.email }); setNewPw(""); }}><KeyRound className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}>{u.is_active ? "Disable" : "Enable"}</Button>
                    {u.id !== me?.id && <Button size="sm" variant="ghost" title="Remove from workspace" onClick={() => { if (confirm("Remove this user?")) remove.mutate(u.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No team members yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 md:hidden">
        {rows.map((u: any) => (
          <Card key={u.id} className="p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{u.full_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              {u.is_active ? <Badge>Active</Badge> : <Badge variant="destructive">Disabled</Badge>}
            </div>
            <select disabled={u.id === me?.id} value={u.roles[0] ?? "staff"} onChange={e => changeRole.mutate({ user_id: u.id, role: e.target.value })}
              className="h-9 w-full px-2 rounded-md border bg-background text-sm">
              <option value="staff">Staff</option><option value="manager">Manager</option><option value="tenant_admin">Admin</option>
            </select>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPwOpen({ id: u.id, name: u.full_name ?? u.email }); setNewPw(""); }}>Reset PW</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => toggleActive.mutate({ id: u.id, active: !u.is_active })}>{u.is_active ? "Disable" : "Enable"}</Button>
              {u.id !== me?.id && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remove?")) remove.mutate(u.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Full name</Label><Input className="mt-1.5" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input className="mt-1.5" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Password (min 8 chars)</Label><Input className="mt-1.5" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
            <div>
              <Label>Role</Label>
              <select className="mt-1.5 w-full h-9 px-3 rounded-md border bg-background text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as any }))}>
                <option value="staff">Staff — day-to-day operations</option>
                <option value="manager">Manager — full access except HR employees</option>
                <option value="tenant_admin">Admin — full access including users & HR</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button disabled={create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create user"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwOpen} onOpenChange={(v) => !v && setPwOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {pwOpen?.name}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>New password (min 8 chars)</Label>
            <Input value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(null)}>Cancel</Button>
            <Button disabled={resetPw.isPending || newPw.length < 8} onClick={() => resetPw.mutate()}>{resetPw.isPending ? "Saving…" : "Reset password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
