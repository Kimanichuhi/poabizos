import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { FeatureGuard, RoleGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2, Plus, MessageSquare, Trash2, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread, listMessages } from "@/lib/ai-chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard/ai-assistant/$threadId")({
  component: () => (
    <FeatureGuard featureKey="ai_assistant">
      <RoleGuard roles={["tenant_admin", "manager", "platform_super_admin"]}>
        <AssistantThreaded />
      </RoleGuard>
    </FeatureGuard>
  ),
});

type Msg = { id?: string; role: "user" | "assistant"; content: string };
type Thread = { id: string; title: string; updated_at: string };

function AssistantThreaded() {
  const { threadId } = useParams({ from: "/_authenticated/dashboard/ai-assistant/$threadId" });
  const nav = useNavigate();
  const listT = useServerFn(listThreads);
  const createT = useServerFn(createThread);
  const deleteT = useServerFn(deleteThread);
  const loadMsgs = useServerFn(listMessages);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshThreads = async () => {
    try { const { threads } = await listT(); setThreads(threads as Thread[]); } catch { /* ignore */ }
  };

  useEffect(() => { refreshThreads(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const { messages } = await loadMsgs({ data: { threadId } });
        setMessages(messages.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      } catch { setMessages([]); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const newChat = async () => {
    try {
      const { thread } = await createT({ data: { title: "New chat" } });
      await refreshThreads();
      nav({ to: "/dashboard/ai-assistant/$threadId", params: { threadId: (thread as any).id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start a new chat");
    }
  };

  const removeThread = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await deleteT({ data: { id } });
    await refreshThreads();
    if (id === threadId) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining[0]) nav({ to: "/dashboard/ai-assistant/$threadId", params: { threadId: remaining[0].id } });
      else nav({ to: "/dashboard/ai-assistant" });
    }
  };

  const stop = () => { abortRef.current?.abort(); };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    const outgoing: Msg[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(outgoing);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const res = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          threadId,
          messages: outgoing.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch { /* noop */ }
        throw new Error(msg);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      refreshThreads();
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { role: "assistant", content: (last?.content || "") + "\n\n_Stopped._" };
          return copy;
        });
      } else {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        toast.error(msg);
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${msg}` };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-4 h-[calc(100vh-8rem)]">
      <aside className="hidden md:flex flex-col border rounded-lg bg-card overflow-hidden">
        <div className="p-2 border-b">
          <Button size="sm" className="w-full" onClick={newChat}><Plus className="h-4 w-4 mr-1" /> New chat</Button>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {threads.length === 0 && <div className="text-xs text-muted-foreground p-3 text-center">No conversations yet.</div>}
          {threads.map((t) => (
            <div key={t.id} className={`group flex items-center gap-1 rounded-md ${t.id === threadId ? "bg-accent" : "hover:bg-accent/50"}`}>
              <Link
                to="/dashboard/ai-assistant/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-sm"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}</div>
                </div>
              </Link>
              <button
                onClick={() => removeThread(t.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive"
                aria-label="Delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center"><Bot className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Answers grounded in your live business data.</p>
          </div>
        </div>

        <Card ref={scrollRef} className="p-4 space-y-3 flex-1 overflow-y-auto">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-10">
              Ask about sales trends, low-stock items, top customers, or expenses.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.content || (streaming && i === messages.length - 1 ? <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</span> : "")}
              </div>
            </div>
          ))}
        </Card>

        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your business…"
            disabled={streaming}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {streaming ? (
            <Button onClick={stop} variant="destructive" className="self-end" aria-label="Stop">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={send} disabled={!input.trim()} className="self-end" aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
