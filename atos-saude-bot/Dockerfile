FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

RUN groupadd --gid 1001 nodeapp && \
    useradd --uid 1001 --gid nodeapp --shell /bin/sh --create-home nodeapp

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN chown -R nodeapp:nodeapp /app

USER nodeapp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
