import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/suppliers")({
  component: () => (
    <FeatureGuard featureKey="suppliers">
      <ResourcePage
        title="Suppliers"
        description="Vendors and suppliers you buy from."
        table="suppliers"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "address", label: "Address", hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
