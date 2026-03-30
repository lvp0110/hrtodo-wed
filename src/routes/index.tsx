import { createFileRoute } from "@tanstack/react-router";
import { OrgChart } from "#/components/OrgChart";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <div style={{ height: "calc(100vh - 80px)" }}>
        <OrgChart />
      </div>
    </main>
  );
}
