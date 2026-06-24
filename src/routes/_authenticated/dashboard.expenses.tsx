import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/expenses")({
  component: () => (
    <FeatureGuard featureKey="expenses">
      <ResourcePage
        title="Expenses"
        description="Track outgoing money by category."
        table="expenses"
        fields={[
          { key: "category", label: "Category", required: true },
          { key: "amount", label: "Amount", type: "money", required: true },
          { key: "expense_date", label: "Date", type: "date", required: true },
          { key: "description", label: "Description", type: "textarea", hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
