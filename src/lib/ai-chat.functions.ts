import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAssistantAccess(supabase: any, userId: string) {
  const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (rolesRows ?? []).map((r: any) => r.role as string);
  const ok = roles.includes("tenant_admin") || roles.includes("manager") || roles.includes("platform_super_admin");
  if (!ok) throw new Error("Forbidden: AI Assistant is available to tenant admins and managers only.");
  const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
  const tenantId = prof?.tenant_id as string | null;
  if (!tenantId) throw new Error("No workspace");
  const { data: feats } = await supabase.rpc("get_tenant_features", { _tenant_id: tenantId });
  const hasAI = (feats ?? []).some((r: any) => r.feature_key === "ai_assistant") || roles.includes("platform_super_admin");
  if (!hasAI) throw new Error("The AI Assistant is not included in your current package.");
  return tenantId;
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const s: any = context.supabase;
    const { data, error } = await s
      .from("ai_chat_threads")
      .select("id, title, updated_at, created_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ({ title: (d as any)?.title ?? "New chat" }))
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const tenantId = await ensureAssistantAccess(s, context.userId);
    const { data: row, error } = await s
      .from("ai_chat_threads")
      .insert({ tenant_id: tenantId, user_id: context.userId, title: data.title })
      .select("id, title, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { thread: row };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { id: string; title: string };
    if (!x?.id || typeof x.title !== "string") throw new Error("bad input");
    return { id: x.id, title: x.title.slice(0, 120) };
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.from("ai_chat_threads").update({ title: data.title }).eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ({ id: (d as any).id as string }))
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { error } = await s.from("ai_chat_threads").delete().eq("id", data.id).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ({ threadId: (d as any).threadId as string }))
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const { data: rows, error } = await s
      .from("ai_chat_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: rows ?? [] };
  });

export const saveAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const x = d as { threadId: string; content: string };
    if (!x?.threadId || typeof x.content !== "string") throw new Error("bad input");
    return { threadId: x.threadId, content: x.content };
  })
  .handler(async ({ context, data }) => {
    const s: any = context.supabase;
    const tenantId = await ensureAssistantAccess(s, context.userId);
    const { error } = await s.from("ai_chat_messages").insert({
      thread_id: data.threadId,
      tenant_id: tenantId,
      user_id: context.userId,
      role: "assistant",
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
