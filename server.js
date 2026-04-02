import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import https from "https";
import proxy from "express-http-proxy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HTTP_PORT = process.env.HTTP_PORT || 3004;
const HTTPS_PORT = process.env.HTTPS_PORT || 3447;
const USE_HTTPS = process.env.USE_HTTPS === "true";

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

// HTTP
app.listen(HTTP_PORT, () => {
  console.log(`HTTP  server: http://localhost:${HTTP_PORT}`);
  console.log(`API_URL: ${process.env.API_URL || "http://localhost:3008"}`);
});

// HTTPS
if (USE_HTTPS) {
  try {
    const certPath = fs.existsSync(path.join(__dirname, "certs"))
      ? path.join(__dirname, "certs")
      : path.join(__dirname, "../certs");

    const httpsOptions = {
      key: fs.readFileSync(path.join(certPath, "privkey.pem")),
      cert: fs.readFileSync(path.join(certPath, "fullchain.pem")),
    };

    https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
      console.log(`HTTPS server: https://localhost:${HTTPS_PORT}`);
    });
  } catch (error) {
    console.error("Failed to start HTTPS server:", error.message);
    console.log("Run ./generate-certs.sh to create certificates");
  }
}
