## ── Stage 1: Build ───────────────────────────────────────────
FROM node:22-slim AS builder

RUN npm i -g corepack@latest && corepack enable

WORKDIR /app

# Install all deps (dev + prod) to build the Vite frontend
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN mkdir -p web
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

COPY . .

# Vite injects VITE_* vars at build-time (not runtime).
# Declare them as ARG so Railway can pass them via --build-arg.
ARG VITE_SENTRY_DSN
ARG VITE_GA_MEASUREMENT_ID
ARG VITE_GTM_CONTAINER_ID
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_APP_ID

ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
ENV VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID
ENV VITE_GTM_CONTAINER_ID=$VITE_GTM_CONTAINER_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_APP_ID=$VITE_APP_ID

# Build Vite frontend (+ Next.js web)
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

# Use node directly so --import registers Sentry's OTEL hooks at the Node loader
# level before Express loads. tsx/esm provides TypeScript support as an ESM hook.
CMD ["node", "--import", "tsx/esm", "--import", "./server/_core/instrument.ts", "./server/_core/index.ts"]
