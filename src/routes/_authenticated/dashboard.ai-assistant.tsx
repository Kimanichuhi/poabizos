import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { chatWithAssistant } from "@/lib/ai-assistant.functions";

export const Route = createFileRoute("/_authenticated/dashboard/ai-assistant")({
  component: () => <FeatureGuard featureKey="ai_assistant"><Assistant /></FeatureGuard>,
});

type Msg = { role: "user" | "assistant"; content: string };

function Assistant() {
  const chat = useServerFn(chatWithAssistant);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your AI assistant. Ask me about sales trends, draft a customer message, or generate reports." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { content } = await chat({ data: { messages: next } });
      setMessages(m => [...m, { role: "assistant", content }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
      setMessages(m => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center"><Bot className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Ask anything about your business data.</p>
        </div>
      </div>
      <Card ref={scrollRef} className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted inline-flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </Card>
      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question…"
          disabled={loading}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <Button onClick={send} disabled={loading || !input.trim()} className="self-end">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
