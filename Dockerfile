## ── Stage 1: Build ───────────────────────────────────────────
FROM node:22-slim AS builder

RUN npm i -g corepack@latest && corepack enable

WORKDIR /app

# Install all deps (dev + prod) to build the Vite frontend
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite injects VITE_* vars at build-time (not runtime).
# Declare them as ARG so Railway can pass them via --build-arg.
ARG VITE_SENTRY_DSN
ARG VITE_GOOGLE_CLIENT_ID

ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN pnpm build

## ── Stage 2: Production ──────────────────────────────────────
FROM node:22-slim AS runner

RUN npm i -g corepack@latest && corepack enable

WORKDIR /app

# Copy manifests first to install only production deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# Copy Vite build output
COPY --from=builder /app/dist ./dist

# Copy Next.js static export (marketing site — web/out/)
COPY --from=builder /app/web/out ./web/out

# Copy server source (transpiled at runtime by tsx)
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

EXPOSE ${PORT:-3000}

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT||3000) + '/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["pnpm", "exec", "tsx", "server/_core/index.ts"]
