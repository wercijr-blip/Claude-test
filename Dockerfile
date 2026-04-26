FROM node:22-slim AS base
RUN npm i -g corepack@latest && corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE ${PORT:-3000}
CMD ["pnpm", "exec", "tsx", "server/_core/index.ts"]
