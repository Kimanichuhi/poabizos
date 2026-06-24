import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/payroll")({
  component: () => (
    <FeatureGuard featureKey="payroll">
      <ResourcePage
        title="Payroll"
        description="Pay runs and net pay."
        table="payrolls"
        fields={[
          { key: "period", label: "Period (e.g. 2026-06)", required: true },
          { key: "gross", label: "Gross", type: "money", required: true },
          { key: "deductions", label: "Deductions", type: "money", defaultValue: 0 },
          { key: "net", label: "Net", type: "money", required: true },
          { key: "paid_on", label: "Paid on", type: "date" },
        ]}
      />
    </FeatureGuard>
  ),
});
