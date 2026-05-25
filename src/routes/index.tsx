import { createFileRoute } from "@tanstack/react-router";
import { OrgChart } from "#/components/OrgChart";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div className="absolute inset-0">
      <OrgChart />
    </div>
  );
}
