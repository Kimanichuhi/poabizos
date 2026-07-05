import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FeatureGuard, RoleGuard } from "@/lib/feature-guard";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread } from "@/lib/ai-chat.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/ai-assistant")({
  component: () => (
    <FeatureGuard featureKey="ai_assistant">
      <RoleGuard roles={["tenant_admin", "manager", "platform_super_admin"]}>
        <AssistantIndex />
      </RoleGuard>
    </FeatureGuard>
  ),
});

function AssistantIndex() {
  const nav = useNavigate();
  const listT = useServerFn(listThreads);
  const createT = useServerFn(createThread);

  useEffect(() => {
    (async () => {
      try {
        const { threads } = await listT();
        if (threads && threads.length > 0) {
          nav({ to: "/dashboard/ai-assistant/$threadId", params: { threadId: (threads[0] as any).id }, replace: true });
        } else {
          const { thread } = await createT({ data: { title: "New chat" } });
          nav({ to: "/dashboard/ai-assistant/$threadId", params: { threadId: (thread as any).id }, replace: true });
        }
      } catch { /* handled by guards */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-[300px] grid place-items-center text-muted-foreground text-sm">
      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Opening AI Assistant…</div>
    </div>
  );
}
