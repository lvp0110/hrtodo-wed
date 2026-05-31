import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Network, Settings, Users } from "lucide-react";
import { authApi, authQueries } from "#/services/api";

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

function UserPanel() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery(authQueries.session);

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: async () => {
      // Куки уже очищены в authApi.logout. resetQueries сбрасывает state
      // активных подписчиков (в т.ч. session-query в RootShell) и форсирует
      // refetch — он упрётся в 401, isAuthed станет false, __root отрисует
      // LoginForm. removeQueries / clear() здесь не подходят: первый не
      // сбрасывает данные у активных observers, второй может оставить их
      // в зависшем pending-состоянии.
      await queryClient.resetQueries();
    },
  });

  const user = sessionQuery.data;
  if (!user) return null;

  const fullName =
    [user.last_name, user.first_name].filter(Boolean).join(" ") || user.email;

  return (
    <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
      <div className="px-3 pb-2">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {fullName}
        </p>
        <p className="truncate text-xs text-gray-400 dark:text-gray-500">
          {user.email}
        </p>
      </div>
      <button
        type="button"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <span className="flex h-5 w-5 items-center justify-center">
          <LogOut size={16} />
        </span>
        {logoutMutation.isPending ? "Выходим…" : "Выйти"}
      </button>
    </div>
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

        <UserPanel />
      </aside>

      <main className="relative flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
