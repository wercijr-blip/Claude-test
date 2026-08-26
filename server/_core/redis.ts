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

// TCP keepalive (probes a cada 10s de inatividade) — sem isso, um NAT/load
// balancer/proxy entre a app e o Redis gerenciado pode derrubar a conexão
// silenciosamente após um período ocioso; o ioredis só percebe a queda no
// próximo comando, gerando reconexões frequentes. Cada reconexão abre uma
// janela onde comandos no redisFailFast (enableOfflineQueue: false) são
// rejeitados na hora com "Stream isn't writeable" — sob tráfego real, isso
// aparece como o erro se repetindo nos logs mesmo com o Redis no ar.
const KEEP_ALIVE_MS = 10_000;

// Client para BullMQ (filas/workers). BullMQ exige maxRetriesPerRequest: null,
// o que faz comandos aguardarem reconexão indefinidamente — aceitável para
// jobs em background, NUNCA para o caminho de requisições HTTP.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  keepAlive: KEEP_ALIVE_MS,
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
  keepAlive: KEEP_ALIVE_MS,
});
attachErrorLogger(redisFailFast, "fail-fast");

// Sem offline queue, comandos emitidos antes da conexão abrir são rejeitados.
// Conecta antecipadamente em produção para os primeiros requests já terem
// rate limit; em dev/test a conexão abre sob demanda (lazyConnect).
//
// index.ts aguarda esta promise (bounded pelo connectTimeout de 2s acima)
// antes de abrir a porta — sem isso, a porta abre e o healthcheck/primeiro
// tráfego real chegam antes da conexão terminar, e cada comando nessa janela
// é rejeitado na hora ("Stream isn't writeable"), aparecendo nos logs a
// cada boot mesmo com o Redis saudável. O bound de 2s não reintroduz o
// crash-loop original (ensureSchema/DB, que não tinha timeout algum) — no
// pior caso (Redis fora do ar) o boot atrasa só esses 2s, nunca trava.
export const redisFailFastReady: Promise<void> =
  env.NODE_ENV === "production"
    ? redisFailFast.connect().catch(() => {
        // erro já logado pelo handler acima; reconexão é automática
      })
    : Promise.resolve();
