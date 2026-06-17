import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
  ],
  envPrefix: "HRWEB",
  server: {
    // host:true — слушать 0.0.0.0, чтобы dev-сервер был доступен из контейнера.
    host: true,
    // В Docker на macOS/Windows события inotify через bind-mount не доходят,
    // поэтому в dev-контейнере включаем polling (VITE_USE_POLLING=true).
    // На хосте переменная не задана — polling выключен, CPU не греется.
    watch: process.env.VITE_USE_POLLING
      ? { usePolling: true, interval: 300 }
      : undefined,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:3008",
        rewrite: (path) => path.replace(/^\/api/, ""),
        changeOrigin: true,
      },
    },
  },
});
