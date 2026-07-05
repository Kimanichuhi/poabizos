import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const { tenant, user } = useAuth();
  const list = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    try {
      const { notifications } = await list();
      setItems(notifications as Notif[]);
    } catch { /* ignore */ }
  };

  useEffect(() => { if (user) refresh(); }, [user]);

  useEffect(() => {
    if (!tenant?.id) return;
    const ch = supabase
      .channel(`notif-${tenant.id}`)
      .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `tenant_id=eq.${tenant.id}` },
          () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const unread = items.filter((n) => !n.read_at);
  const markAll = async () => {
    if (unread.length === 0) return;
    await markRead({ data: { ids: unread.map((n) => n.id) } });
    refresh();
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} className="relative">
        <Bell className="h-4 w-4" />
        {unread.length > 0 && (
          <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]">{unread.length}</Badge>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border rounded-md shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">Notifications</span>
            {unread.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAll}>
                <Check className="h-3 w-3 mr-1" /> Mark all read
              </Button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No notifications yet.</div>}
            {items.map((n) => (
              <div key={n.id} className={`px-3 py-2 border-b last:border-0 text-sm ${n.read_at ? "opacity-70" : "bg-accent/30"}`}>
                <div className="font-medium">{n.title}</div>
                {n.body && <div className="text-muted-foreground text-xs mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
