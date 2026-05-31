import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import proxy from "express-http-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HTTP_PORT = Number(process.env.HTTP_PORT) || 3004;
const API_URL = process.env.API_URL || "http://localhost:3008";

// Инъектируем переменные окружения с префиксом HRWEB_ в HTML —
// фронт читает их через window.__ENV__ во время рантайма.
const injectEnvVariables = (html) => {
  let envScript = "<script>\n";
  envScript += "window.__ENV__ = {};\n";

  Object.keys(process.env).forEach((key) => {
    if (key.startsWith("HRWEB_")) {
      envScript += `window.__ENV__["${key}"] = "${process.env[key]}";\n`;
    }
  });

  envScript += "</script>";

  return html.replace("<head>", "<head>" + envScript);
};

// Проксируем /api/* на бэкенд, срезая префикс /api.
app.use(
  "/api",
  proxy(API_URL, {
    proxyReqPathResolver: (req) => {
      const targetPath = req.originalUrl.replace(/^\/api/, "");
      console.log(`Proxy: /api${targetPath} → ${API_URL}${targetPath}`);
      return targetPath;
    },
    // Сохраняем куки и Authorization-заголовки бэкенда.
    proxyReqOptDecorator: (proxyReqOpts) => proxyReqOpts,
    userResHeaderDecorator: (headers) => headers,
  }),
);

// Health-эндпоинт для smoke-test'а из deploy-скрипта.
app.get("/__health", (_, res) => res.json({ ok: true }));

// Статические ассеты с длинным cache: имена hash'ятся vite'ом, безопасно.
app.use(
  "/assets",
  express.static(path.join(__dirname, "dist/assets"), {
    maxAge: "1y",
    immutable: true,
  }),
);

// SPA fallback — index.html с инъекцией env-переменных, без кеша.
app.get("*", (_, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");

  fs.readFile(indexPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading index.html:", err);
      return res.status(500).send("Error loading application");
    }

    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "no-cache");
    res.send(injectEnvVariables(data));
  });
});

const server = app.listen(HTTP_PORT, () => {
  console.log(`HTTP server: http://localhost:${HTTP_PORT}`);
  console.log(`API proxy:   /api → ${API_URL}`);
});

// Graceful shutdown — даём Docker корректно остановить контейнер.
const shutdown = (signal) => {
  console.log(`[server] ${signal} received, closing...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
