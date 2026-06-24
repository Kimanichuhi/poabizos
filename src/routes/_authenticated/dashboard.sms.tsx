import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { Placeholder } from "./dashboard.mpesa";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/sms")({
  component: () => (
    <FeatureGuard featureKey="sms">
      <Placeholder icon={MessageSquare} title="SMS Messaging" desc="Send transactional SMS to customers (receipts, reminders, marketing). Hook up an SMS provider (e.g. Africa's Talking, Twilio) by adding API credentials." />
    </FeatureGuard>
  ),
});
