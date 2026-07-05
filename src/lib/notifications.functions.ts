import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s: any = context.supabase;
    const { data, error } = await s
      .from("notifications")
      .select("id, kind, title, body, metadata, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { notifications: data ?? [] };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const ids = (d as any)?.ids;
    if (!Array.isArray(ids)) throw new Error("ids required");
    return { ids: ids.map((x) => String(x)) };
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.rpc("mark_notifications_read", { _ids: data.ids });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
