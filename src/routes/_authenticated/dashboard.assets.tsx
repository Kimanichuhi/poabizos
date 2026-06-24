import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/assets")({
  component: () => (
    <FeatureGuard featureKey="assets">
      <ResourcePage
        title="Assets"
        description="Fixed assets and equipment."
        table="assets"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "category", label: "Category" },
          { key: "cost", label: "Cost", type: "money" },
          { key: "purchase_date", label: "Purchase date", type: "date" },
          { key: "location", label: "Location" },
          { key: "status", label: "Status", type: "select", defaultValue: "active", options: [
            { value: "active", label: "Active" }, { value: "in_repair", label: "In repair" }, { value: "disposed", label: "Disposed" },
          ]},
        ]}
      />
    </FeatureGuard>
  ),
});
