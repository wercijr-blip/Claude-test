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

# Copy manifests and node_modules (full install including devDeps for drizzle-kit)
COPY package.json pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules

# Copy Vite build output
COPY --from=builder /app/dist ./dist

# Copy server source (transpiled at runtime by tsx)
COPY server ./server
COPY shared ./shared
COPY drizzle ./drizzle
COPY drizzle.config.ts ./

EXPOSE ${PORT:-3000}

CMD ["sh", "-c", "pnpm db:push && pnpm exec tsx server/_core/index.ts"]
