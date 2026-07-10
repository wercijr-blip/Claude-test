import IORedis from "ioredis";
import { env } from "./env.ts";
import { logger } from "./logger.ts";

// Loga erros de conexão no máximo 1x/30s por client — Redis fora do ar gera
// um erro por tentativa de reconexão e inundaria os logs.
function attachErrorLogger(client: IORedis, name: string): void {
  let lastLog = 0;
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastLog > 30_000) {
      lastLog = now;
      logger.error(`[redis:${name}] erro de conexão`, {
        error: (err as Error).message,
      });
    }
  });
}

// Client para BullMQ (filas/workers). BullMQ exige maxRetriesPerRequest: null,
// o que faz comandos aguardarem reconexão indefinidamente — aceitável para
// jobs em background, NUNCA para o caminho de requisições HTTP.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
attachErrorLogger(redis, "bullmq");

// Client fail-fast para caminhos por-requisição (rate limiters).
// Sem offline queue e com retry mínimo: se o Redis cair, comandos falham em
// milissegundos em vez de pendurar toda requisição HTTP até reconectar.
// Combinado com passOnStoreError nos limiters, o site continua no ar
// (fail-open) durante uma indisponibilidade do Redis.
export const redisFailFast = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  connectTimeout: 2_000,
  lazyConnect: true,
});
attachErrorLogger(redisFailFast, "fail-fast");

// Sem offline queue, comandos emitidos antes da conexão abrir são rejeitados.
// Conecta antecipadamente em produção para os primeiros requests já terem
// rate limit; em dev/test a conexão abre sob demanda (lazyConnect).
if (env.NODE_ENV === "production") {
  redisFailFast.connect().catch(() => {
    // erro já logado pelo handler acima; reconexão é automática
  });
}
