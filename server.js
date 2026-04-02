import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import proxy from "express-http-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Инъектируем переменные окружения с префиксом HRWEB_ в HTML
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

// Проксируем /api/* на бэкенд
app.use(
  "/api",
  proxy(process.env.API_URL || "http://localhost:3008", {
    proxyReqPathResolver: (req) => {
      const targetPath = req.originalUrl.replace(/^\/api/, "");
      console.log(`Proxy: /api${targetPath} → ${process.env.API_URL}${targetPath}`);
      return targetPath;
    },
  })
);

// Статические ассеты
app.use("/assets", express.static(path.join(__dirname, "dist/assets")));

// SPA fallback — index.html с инъекцией переменных окружения
app.get("*", (_, res) => {
  const indexPath = path.join(__dirname, "dist", "index.html");

  fs.readFile(indexPath, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading index.html:", err);
      return res.status(500).send("Error loading application");
    }

    res.set("Content-Type", "text/html");
    res.send(injectEnvVariables(data));
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API_URL: ${process.env.API_URL || "http://localhost:3008"}`);
});
