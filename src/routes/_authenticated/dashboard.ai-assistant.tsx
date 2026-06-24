import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/ai-assistant")({
  component: () => <FeatureGuard featureKey="ai_assistant"><Assistant /></FeatureGuard>,
});

function Assistant() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Hi! I'm your AI assistant. Ask me about sales trends, draft a customer message, or generate reports." },
  ]);
  const [input, setInput] = useState("");
  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { role: "user", content: input }, { role: "assistant", content: "Connect the Lovable AI Gateway to enable live responses — this is the chat shell ready for wiring up." }]);
    setInput("");
    toast.info("Demo response — wire up Lovable AI to enable live chat.");
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
      <Card className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
          </div>
        ))}
      </Card>
      <div className="flex gap-2">
        <Textarea rows={2} value={input} onChange={e => setInput(e.target.value)} placeholder="Ask a question…" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <Button onClick={send} className="self-end"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
