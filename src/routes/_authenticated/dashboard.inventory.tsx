import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/inventory")({
  component: () => (
    <FeatureGuard featureKey="inventory">
      <ResourcePage
        title="Inventory"
        description="Products in stock."
        table="products"
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "sku", label: "SKU" },
          { key: "price", label: "Price", type: "money", required: true },
          { key: "cost", label: "Cost", type: "money" },
          { key: "stock_quantity", label: "Stock", type: "number", required: true, defaultValue: 0 },
          { key: "reorder_level", label: "Reorder at", type: "number", defaultValue: 0, hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
