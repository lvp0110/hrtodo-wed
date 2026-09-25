import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import { authQueries } from "#/services/api";
import { subscribeAuthExpired } from "#/services/authRefresh";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        const code = (error as { code?: number }).code;
        if (code === 401 || code === 403) return false;
        return failureCount < 1;
      },
    },
  },
});

// Refresh не удался или повторный запрос снова 401 — показываем вход.
subscribeAuthExpired(() => {
  queryClient.setQueryData(authQueries.session.queryKey, null);
});

// Прогрев справочников выполняется в __root.tsx после успешной авторизации —
// до неё все запросы к /api отдадут 401.

const rootElement = document.getElementById("root")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={getRouter()} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
