import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/hr")({
  component: () => (
    <FeatureGuard featureKey="hr">
      <ResourcePage
        title="Employees"
        description="HR records for your team."
        table="employees"
        fields={[
          { key: "full_name", label: "Full name", required: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone", hideInTable: true },
          { key: "position", label: "Position" },
          { key: "department", label: "Department" },
          { key: "salary", label: "Salary", type: "money" },
          { key: "hire_date", label: "Hire date", type: "date", hideInTable: true },
          { key: "status", label: "Status", type: "select", defaultValue: "active", options: [
            { value: "active", label: "Active" }, { value: "on_leave", label: "On leave" }, { value: "terminated", label: "Terminated" },
          ]},
        ]}
      />
    </FeatureGuard>
  ),
});
