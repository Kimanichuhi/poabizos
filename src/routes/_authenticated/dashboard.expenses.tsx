import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ExpensesPage } from "@modules/expenses/pages/expenses-page";

export const Route = createFileRoute("/_authenticated/dashboard/expenses")({
  component: () => (
    <FeatureGuard featureKey="expenses">
      <ExpensesPage />
    </FeatureGuard>
  ),
});
