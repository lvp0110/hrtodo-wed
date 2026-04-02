# ── Stage 1: dependencies ────────────────────────────────────
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules
RUN npm run build

# ── Stage 3: production ──────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=dependencies /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
