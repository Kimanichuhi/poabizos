import { createFileRoute } from "@tanstack/react-router";
import { FeatureGuard } from "@/lib/feature-guard";
import { ResourcePage } from "@/components/resource-page";

export const Route = createFileRoute("/_authenticated/dashboard/tasks")({
  component: () => (
    <FeatureGuard featureKey="tasks">
      <ResourcePage
        title="Tasks"
        description="Things your team needs to do."
        table="tasks"
        fields={[
          { key: "title", label: "Title", required: true },
          { key: "priority", label: "Priority", type: "select", defaultValue: "medium", options: [
            { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }, { value: "urgent", label: "Urgent" },
          ]},
          { key: "status", label: "Status", type: "select", defaultValue: "open", options: [
            { value: "open", label: "Open" }, { value: "in_progress", label: "In progress" }, { value: "done", label: "Done" },
          ]},
          { key: "due_date", label: "Due date", type: "date" },
          { key: "description", label: "Description", type: "textarea", hideInTable: true },
        ]}
      />
    </FeatureGuard>
  ),
});
