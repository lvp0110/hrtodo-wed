# syntax=docker/dockerfile:1
#
# Runtime-образ фронта: vite-сборка кладётся в /app/dist, express-server
# отдаёт статику и проксирует /api в backend (URL берёт из env API_URL).
# TLS терминируется на host nginx — certs внутрь контейнера не кладём.

# ── Stage 1: deps (включая dev — нужны для vite build) ───────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: runtime (только prod-зависимости + dist + server.js) ─
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

USER node

EXPOSE 3004

CMD ["node", "server.js"]
