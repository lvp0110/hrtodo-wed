import { useEffect } from "react";
import {
  createRootRoute,
  Outlet,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "#/components/AppShell";
import { LoginForm } from "#/components/LoginForm";
import { authQueries, dictQueries, employeeQueries, orgNodesApi } from "#/services/api";

function RootShell() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const sessionQuery = useQuery(authQueries.session);

  const isAuthed = sessionQuery.isSuccess && !!sessionQuery.data;

  // Прогреваем справочники сразу после успешной авторизации, чтобы модалки
  // открывались с уже готовыми данными. До авторизации запросы вернули бы 401.
  useEffect(() => {
    if (!isAuthed) return;

    queryClient.prefetchQuery(dictQueries.cities);
    queryClient.prefetchQuery(dictQueries.countries);
    queryClient.prefetchQuery(dictQueries.employees);
    queryClient.prefetchQuery(employeeQueries.report);
    queryClient.prefetchQuery(dictQueries.nodeTypes);
    queryClient.prefetchQuery({
      queryKey: ["orgTree"],
      queryFn: () => orgNodesApi.getTreeVacancies().then((res) => res.data ?? []),
    });

    // На случай если до логина уже был отрендерен матч роута — пересоберём данные.
    router.invalidate();
  }, [isAuthed, queryClient, router]);

  if (sessionQuery.isPending) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-400">
        Загрузка…
      </div>
    );
  }

  if (!isAuthed) {
    return <LoginForm />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createRootRoute({
  component: () => (
    <>
      <RootShell />
      <TanStackRouterDevtools />
    </>
  ),
});
