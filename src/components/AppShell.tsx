import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Network, Settings, Users } from "lucide-react";

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
}

function NavItem({ to, icon, label }: NavItemProps) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      activeProps={{
        className:
          "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
      }}
      inactiveProps={{
        className:
          "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
      }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
    >
      <span className="flex h-5 w-5 items-center justify-center">{icon}</span>
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen bg-gray-50 dark:bg-gray-950">
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="px-3 pb-4 text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400">
          HR TODO
        </div>
        <nav className="flex flex-col gap-1">
          <NavItem to="/" icon={<Network size={16} />} label="Оргструктура" />
          <NavItem
            to="/employees"
            icon={<Users size={16} />}
            label="Сотрудники"
          />
          <NavItem
            to="/settings"
            icon={<Settings size={16} />}
            label="Настройки"
          />
        </nav>
      </aside>

      <main className="relative flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
