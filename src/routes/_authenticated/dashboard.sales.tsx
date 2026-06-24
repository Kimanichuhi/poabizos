import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/sales")({
  component: () => (
    <FeatureGuard featureKey="sales">
      <ResourcePage
        title="Sales"
        description="Record every sale your business makes."
        table="sales"
        fields={[
          { key: "total_amount", label: "Amount", type: "money", required: true },
          { key: "payment_method", label: "Payment method", type: "select", options: [
            { value: "cash", label: "Cash" }, { value: "card", label: "Card" },
            { value: "mpesa", label: "M-Pesa" }, { value: "bank", label: "Bank" },
          ]},
          { key: "status", label: "Status", type: "select", defaultValue: "completed", options: [
            { value: "completed", label: "Completed" }, { value: "pending", label: "Pending" },
            { value: "refunded", label: "Refunded" },
          ]},
          { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
