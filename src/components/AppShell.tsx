import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ListTree,
  LogOut,
  Network,
  Settings,
  Users,
} from "lucide-react";
import { authApi, authQueries } from "#/services/api";

const NAV_ITEMS = [
  { to: "/", icon: <Network size={16} />, label: "Оргструктура" },
  { to: "/structure", icon: <ListTree size={16} />, label: "Структура" },
  { to: "/employees", icon: <Users size={16} />, label: "Сотрудники" },
  { to: "/settings", icon: <Settings size={16} />, label: "Настройки" },
] as const;

interface NavItemProps {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed: boolean;
  layout?: "sidebar" | "bottom";
}

function NavItem({
  to,
  icon,
  label,
  collapsed,
  layout = "sidebar",
}: NavItemProps) {
  const isBottom = layout === "bottom";

  return (
    <Link
      to={to}
      title={collapsed && !isBottom ? label : undefined}
      activeOptions={{ exact: to === "/" }}
      activeProps={{
        className:
          "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
      }}
      inactiveProps={{
        className:
          "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100",
      }}
      className={
        isBottom
          ? "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-xs font-medium transition-colors"
          : `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            }`
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      {(!collapsed || isBottom) && (
        <span
          className={
            isBottom
              ? "max-w-full truncate text-[10px] leading-tight"
              : "truncate"
          }
        >
          {label}
        </span>
      )}
    </Link>
  );
}

function UserPanel({
  collapsed,
  layout = "sidebar",
}: {
  collapsed: boolean;
  layout?: "sidebar" | "bottom";
}) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery(authQueries.session);

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async () => {
      await queryClient.resetQueries();
    },
  });

  const user = sessionQuery.data;
  if (!user) return null;

  const fullName =
    [user.last_name, user.first_name].filter(Boolean).join(" ") || user.email;

  if (layout === "bottom") {
    return (
      <button
        type="button"
        title="Выйти"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <LogOut size={16} />
        </span>
        <span className="text-[10px] leading-tight">
          {logoutMutation.isPending ? "…" : "Выйти"}
        </span>
      </button>
    );
  }

  return (
    <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
      {!collapsed && (
        <div className="px-3 pb-2">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {fullName}
          </p>
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">
            {user.email}
          </p>
        </div>
      )}
      <button
        type="button"
        title={collapsed ? "Выйти" : undefined}
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 ${
          collapsed ? "justify-center px-2" : "gap-3 px-3"
        }`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <LogOut size={16} />
        </span>
        {!collapsed &&
          (logoutMutation.isPending ? "Выходим…" : "Выйти")}
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = !expanded;

  return (
    <div className="flex h-screen w-screen flex-col bg-gray-50 dark:bg-gray-950 sm:flex-row">
      <div className="relative hidden w-[70px] shrink-0 sm:block">
        <aside
          className={`absolute inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r border-gray-200 bg-white py-4 transition-[width] duration-200 ease-out dark:border-gray-800 dark:bg-gray-900 ${
            collapsed
              ? "w-[70px] px-2"
              : "w-56 px-3 shadow-lg dark:shadow-black/40"
          }`}
        >
          <div
            className={`flex pb-4 ${
              collapsed
                ? "flex-col items-center gap-1 px-0"
                : "items-center justify-between px-3"
            }`}
          >
            <div
              className={`text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 ${
                collapsed ? "text-xs" : ""
              }`}
            >
              {collapsed ? "HR" : "HR TODO"}
            </div>
            <button
              type="button"
              title={collapsed ? "Развернуть" : "Свернуть"}
              onClick={() => setExpanded(!expanded)}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              {collapsed ? (
                <ChevronRight size={16} />
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <UserPanel collapsed={collapsed} />
        </aside>
      </div>

      <main className="relative min-h-0 flex-1 overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-0">
        {children}
      </main>

      <aside className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-stretch gap-1 border-t border-gray-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] dark:border-gray-800 dark:bg-gray-900 sm:hidden">
        <nav className="flex min-w-0 flex-1 items-stretch gap-1">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={false}
              layout="bottom"
            />
          ))}
        </nav>
        <UserPanel collapsed layout="bottom" />
      </aside>
    </div>
  );
}
