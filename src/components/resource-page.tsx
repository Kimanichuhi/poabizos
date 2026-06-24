import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { fmtDate, fmtDateTime, fmtMoney } from "@/lib/format";

export type FieldType = "text" | "number" | "money" | "date" | "textarea" | "select";

export interface ResourceField {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  hideInTable?: boolean;
  hideInForm?: boolean;
  render?: (row: any) => ReactNode;
}

interface Props {
  title: string;
  description?: string;
  table: string;
  fields: ResourceField[];
  orderBy?: string;
  filter?: (q: any) => any;
}

export function ResourcePage({ title, description, table, fields, orderBy = "created_at", filter }: Props) {
  const { tenant, isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const queryKey = ["resource", table, tenant?.id];
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    enabled: !!tenant?.id || isPlatformAdmin,
    queryFn: async () => {
      let q: any = (supabase as any).from(table).select("*").order(orderBy, { ascending: false }).limit(500);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (values: any) => {
      const payload: any = { ...values, tenant_id: tenant?.id };
      if (editing?.id) {
        const { error } = await (supabase as any).from(table).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from(table).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const tableFields = fields.filter(f => !f.hideInTable);
  const formFields = fields.filter(f => !f.hideInForm);

  const renderCell = (f: ResourceField, row: any) => {
    if (f.render) return f.render(row);
    const v = row[f.key];
    if (v == null) return <span className="text-muted-foreground">—</span>;
    if (f.type === "money") return fmtMoney(Number(v));
    if (f.type === "date") return fmtDate(String(v));
    return String(v);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {tableFields.map(f => <th key={f.key} className="px-4 py-3 font-medium">{f.label}</th>)}
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={tableFields.length + 2} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={tableFields.length + 2} className="px-4 py-10 text-center text-muted-foreground">No records yet. Click <span className="text-foreground font-medium">New</span> to add one.</td></tr>
              ) : rows.map((row: any) => (
                <tr key={row.id} className="border-t hover:bg-muted/30">
                  {tableFields.map(f => <td key={f.key} className="px-4 py-3">{renderCell(f, row)}</td>)}
                  <td className="px-4 py-3 text-muted-foreground">{fmtDateTime(row.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(row); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this record?")) del.mutate(row.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const values: any = {};
              for (const f of formFields) {
                let v: any = fd.get(f.key);
                if (v === "" || v == null) v = null;
                if (v != null && (f.type === "number" || f.type === "money")) v = Number(v);
                values[f.key] = v;
              }
              upsert.mutate(values);
            }}
            className="space-y-3"
          >
            {formFields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}</Label>
                {f.type === "textarea" ? (
                  <Textarea id={f.key} name={f.key} required={f.required} defaultValue={editing?.[f.key] ?? f.defaultValue ?? ""} rows={3} />
                ) : f.type === "select" ? (
                  <select id={f.key} name={f.key} required={f.required} defaultValue={editing?.[f.key] ?? f.defaultValue ?? ""} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                    <option value="">— select —</option>
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input
                    id={f.key} name={f.key} required={f.required}
                    type={f.type === "number" || f.type === "money" ? "number" : f.type === "date" ? "date" : "text"}
                    step={f.type === "money" ? "0.01" : undefined}
                    defaultValue={editing?.[f.key] ?? f.defaultValue ?? ""}
                  />
                )}
              </div>
            ))}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={upsert.isPending}>{upsert.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
