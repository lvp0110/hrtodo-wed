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
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:3008",
        rewrite: (path) => path.replace(/^\/api/, ""),
        changeOrigin: true,
      },
    },
  },
});
