import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { buildBusinessContext, sanitizeAiText } from "@/lib/ai-assistant-context.server";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/ai-assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) return jsonError(401, "unauthorized", "You must be signed in.");
        const token = authHeader.slice("Bearer ".length);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_KEY) return jsonError(500, "server_misconfigured", "Backend is not configured.");
        if (!LOVABLE_API_KEY) return jsonError(500, "server_misconfigured", "AI is not configured.");

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: authData, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !authData?.user) return jsonError(401, "unauthorized", "Your session has expired. Please sign in again.");
        const userId = authData.user.id;

        // Role + feature check
        const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        const roles = (rolesRows ?? []).map((r: any) => r.role as string);
        const isPlatformAdmin = roles.includes("platform_super_admin");
        const roleOk = roles.includes("tenant_admin") || roles.includes("manager") || isPlatformAdmin;
        if (!roleOk) return jsonError(403, "forbidden", "The AI Assistant is available to tenant admins and managers only.");
        const { data: prof } = await supabase.from("profiles").select("tenant_id").eq("id", userId).maybeSingle();
        const tenantId = (prof?.tenant_id as string | null) ?? null;
        if (!tenantId) return jsonError(403, "no_workspace", "You are not part of a workspace yet.");
        if (!isPlatformAdmin) {
          const { data: feats } = await supabase.rpc("get_tenant_features", { _tenant_id: tenantId });
          const has = (feats ?? []).some((r: any) => r.feature_key === "ai_assistant");
          if (!has) return jsonError(403, "feature_locked", "The AI Assistant is not included in your current package.");
        }

        // Parse body
        let body: { threadId?: string; messages?: ChatMessage[] };
        try { body = await request.json(); } catch { return jsonError(400, "bad_request", "Invalid request body."); }
        const threadId = body.threadId;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        if (!threadId || messages.length === 0) return jsonError(400, "bad_request", "Missing threadId or messages.");
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (!lastUser) return jsonError(400, "bad_request", "No user message to answer.");

        // Persist user message
        {
          const { error } = await supabase.from("ai_chat_messages").insert({
            thread_id: threadId, tenant_id: tenantId, user_id: userId,
            role: "user", content: lastUser.content,
          });
          if (error) {
            console.error("[ai-assistant] persist-user failed", { userId, threadId, error: error.message });
            return jsonError(500, "persist_failed", "Could not save your message.");
          }
        }

        // Auto-title thread if still default
        try {
          const { data: t } = await supabase.from("ai_chat_threads").select("title").eq("id", threadId).maybeSingle();
          if (t && (t.title === "New chat" || !t.title)) {
            await supabase.from("ai_chat_threads").update({
              title: lastUser.content.slice(0, 60),
            }).eq("id", threadId).eq("user_id", userId);
          }
        } catch { /* non-fatal */ }

        // Build business context + system prompt
        let contextBlock = "";
        try { contextBlock = await buildBusinessContext(supabase, tenantId); }
        catch (e) { console.error("[ai-assistant] context failed", e); }

        const systemPrompt: ChatMessage = {
          role: "system",
          content:
            "You are the PoaBiz OS business assistant. Follow these rules strictly:\n" +
            "1. Answer only the exact question asked. No greetings, no sign-offs, no offers of further help, no preamble like 'Sure' or 'Certainly'.\n" +
            "2. Never add unrelated sections, tips, or summaries the user did not request.\n" +
            "3. Use only the live business data below when citing numbers. Never invent numbers.\n" +
            "4. If the answer is not in the data, say so in one short sentence.\n" +
            "5. Only reference modules/features that appear in the 'Modules available in this package' list. If a user asks about a module not in that list, reply that it is not included in the current package and list what is available.\n" +
            "6. Do not use asterisks (`*` or `**`) anywhere. Use plain text or hyphen bullets (`- `).\n" +
            "7. Be professional, concise, and direct.\n\n" +
            "=== Live business data ===\n" + contextBlock,
        };

        const model = "google/gemini-2.5-flash";

        // Log user turn to audit trail (fire-and-forget)
        supabase.rpc("log_ai_turn", {
          _tenant_id: tenantId, _thread_id: threadId, _role: "user",
          _length: lastUser.content.length, _model: model, _status: "ok",
        }).then(({ error }: any) => { if (error) console.error("[ai-assistant] audit user", error.message); });

        // Call Lovable AI Gateway with streaming + abort
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [systemPrompt, ...messages.slice(-30).map((m) => ({ role: m.role, content: m.content }))],
          }),
          signal: request.signal,
        }).catch((e) => {
          if ((e as any)?.name === "AbortError") return null;
          throw e;
        });

        if (!aiRes) return new Response("", { status: 499 });

        if (!aiRes.ok) {
          const text = await aiRes.text().catch(() => "");
          const runId = aiRes.headers.get("x-lovable-aig-run-id");
          console.error("[ai-assistant] gateway error", { status: aiRes.status, runId, body: text.slice(0, 500) });
          if (aiRes.status === 429) return jsonError(429, "rate_limited", "The AI is busy right now. Please try again in a few seconds.");
          if (aiRes.status === 402) return jsonError(402, "no_credits", "Your workspace has run out of AI credits. Please top up in workspace billing.");
          return jsonError(502, "ai_error", "Something went wrong contacting the AI. Please try again.");
        }

        // Parse SSE stream from gateway; emit plain-text chunks to the client.
        const reader = aiRes.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let fullText = "";

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let buf = "";
            const flushPersist = async (partial: boolean) => {
              const clean = sanitizeAiText(fullText).trim();
              if (!clean) return;
              const marked = partial ? clean + "\n\n_Stopped._" : clean;
              const { error } = await supabase.from("ai_chat_messages").insert({
                thread_id: threadId, tenant_id: tenantId, user_id: userId,
                role: "assistant", content: marked,
              });
              if (error) console.error("[ai-assistant] persist-assistant failed", error.message);
              supabase.rpc("log_ai_turn", {
                _tenant_id: tenantId, _thread_id: threadId, _role: "assistant",
                _length: marked.length, _model: model,
                _status: partial ? "stopped" : "ok",
              }).then(({ error }: any) => { if (error) console.error("[ai-assistant] audit assistant", error.message); });
            };

            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split("\n");
                buf = lines.pop() ?? "";
                for (const raw of lines) {
                  const line = raw.trim();
                  if (!line.startsWith("data:")) continue;
                  const payload = line.slice(5).trim();
                  if (!payload || payload === "[DONE]") continue;
                  try {
                    const evt = JSON.parse(payload);
                    const delta: string | undefined = evt?.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullText += delta;
                      // stream sanitized chunks progressively (strip stray * as they arrive)
                      const chunk = delta.replace(/\*/g, "");
                      controller.enqueue(encoder.encode(chunk));
                    }
                  } catch { /* ignore malformed */ }
                }
              }
              await flushPersist(false);
              controller.close();
            } catch (e: any) {
              const aborted = e?.name === "AbortError" || request.signal.aborted;
              if (aborted) {
                await flushPersist(true);
                try { controller.close(); } catch { /* noop */ }
                return;
              }
              console.error("[ai-assistant] stream error", e);
              try { controller.error(e); } catch { /* noop */ }
            }
          },
          async cancel() {
            try { await reader.cancel(); } catch { /* noop */ }
            const clean = sanitizeAiText(fullText).trim();
            if (clean) {
              await supabase.from("ai_chat_messages").insert({
                thread_id: threadId, tenant_id: tenantId, user_id: userId,
                role: "assistant", content: clean + "\n\n_Stopped._",
              }).then(({ error }: any) => { if (error) console.error("[ai-assistant] persist-cancel failed", error.message); });
            }
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
