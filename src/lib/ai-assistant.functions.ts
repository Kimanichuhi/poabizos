import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export const chatWithAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { messages?: unknown };
    if (!Array.isArray(d.messages)) throw new Error("messages required");
    const messages = d.messages
      .filter((m): m is ChatMessage =>
        !!m && typeof m === "object" &&
        (["user", "assistant", "system"] as const).includes((m as ChatMessage).role) &&
        typeof (m as ChatMessage).content === "string",
      )
      .slice(-30);
    if (messages.length === 0) throw new Error("messages required");
    return { messages };
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const systemPrompt: ChatMessage = {
      role: "system",
      content:
        "You are PoaBiz OS's AI assistant. Help the user with business questions: sales trends, inventory, drafting customer messages, and general operations. Be concise, friendly, and use markdown formatting.",
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [systemPrompt, ...data.messages],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace billing.");
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) throw new Error("Empty response from AI");
    return { content };
  });
