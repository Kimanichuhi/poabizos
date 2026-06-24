import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/debtors")({
  component: () => (
    <FeatureGuard featureKey="debtors">
      <ResourcePage
        title="Debtors"
        description="Track amounts owed to you."
        table="debtors"
        fields={[
          { key: "amount_owed", label: "Amount owed", type: "money", required: true },
          { key: "due_date", label: "Due date", type: "date" },
          { key: "status", label: "Status", type: "select", defaultValue: "pending", options: [
            { value: "pending", label: "Pending" }, { value: "partial", label: "Partial" },
            { value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" },
          ]},
          { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
