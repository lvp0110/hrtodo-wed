import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import { dictQueries } from "#/services/api";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Прогреваем справочники сразу при старте — модалки уже застают их в кеше.
queryClient.prefetchQuery(dictQueries.cities);
queryClient.prefetchQuery(dictQueries.employees);
queryClient.prefetchQuery(dictQueries.nodeTypes);

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
