## ── Stage 1: Build ───────────────────────────────────────────
FROM node:22-slim AS builder

RUN npm i -g corepack@latest && corepack enable

WORKDIR /app

# Install all deps (dev + prod) to build the Vite frontend
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build Vite frontend
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

# Copy server source (transpiled at runtime by tsx)
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle

EXPOSE ${PORT:-3000}

CMD ["pnpm", "exec", "tsx", "server/_core/index.ts"]
