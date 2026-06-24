import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/customers")({
  component: () => (
    <FeatureGuard featureKey="customers">
      <ResourcePage
        title="Customers"
        description="Your customer directory."
        table="customers"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
          { key: "address", label: "Address", hideInTable: true },
          { key: "notes", label: "Notes", type: "textarea", hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
