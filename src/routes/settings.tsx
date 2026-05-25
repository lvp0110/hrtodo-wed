import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({ component: SettingsLayout });

const tabs = [
  { to: "/settings/cities", label: "Города" },
  { to: "/settings/countries", label: "Страны" },
  { to: "/settings/orgnodetypes", label: "Типы узлов" },
] as const;

function SettingsLayout() {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-8 pt-6 dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Настройки справочников
        </h1>
        <nav className="mt-4 flex gap-1">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeProps={{
                className:
                  "border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300",
              }}
              inactiveProps={{
                className:
                  "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100",
              }}
              className="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-auto bg-gray-50 px-8 py-6 dark:bg-gray-950">
        <Outlet />
      </div>
    </div>
  );
}
