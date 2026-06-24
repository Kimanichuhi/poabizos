import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { Card } from "@/components/ui/card";
import { Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/mpesa")({
  component: () => (
    <FeatureGuard featureKey="mpesa">
      <Placeholder
        icon={Smartphone}
        title="M-Pesa Integration"
        desc="Connect your Safaricom Daraja credentials to accept STK push payments and reconcile transactions automatically. Provide a consumer key, consumer secret, shortcode, and passkey to get started."
      />
    </FeatureGuard>
  ),
});

export function Placeholder({ icon: Icon, title, desc }: any) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="p-8 text-center">
        <Icon className="h-10 w-10 mx-auto text-primary mb-3" />
        <h2 className="font-medium">Configure provider credentials</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">{desc}</p>
        <p className="text-xs text-muted-foreground mt-4">Ask the platform admin to wire up the provider keys for your workspace.</p>
      </Card>
    </div>
  );
}
