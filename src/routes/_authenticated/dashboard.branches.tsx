import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/branches")({
  component: () => (
    <FeatureGuard featureKey="multi_branch">
      <ResourcePage
        title="Branches"
        description="Manage multiple business locations."
        table="branches"
        fields={[
          { key: "name", label: "Branch name", required: true },
          { key: "location", label: "Location" },
          { key: "phone", label: "Phone" },
        ]}
      />
    </FeatureGuard>
  ),
});
