import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { Placeholder } from "./dashboard.mpesa";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/whatsapp")({
  component: () => (
    <FeatureGuard featureKey="whatsapp">
      <Placeholder icon={MessageSquare} title="WhatsApp Business" desc="Send order confirmations, receipts and reminders via WhatsApp Business API. Requires a Meta-approved business account and access token." />
    </FeatureGuard>
  ),
});
