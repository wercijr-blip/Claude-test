// Standalone entry point for BullMQ workers.
// Run with: tsx server/workers.ts
// In Railway: configure a second service with this command so workers
// run in a separate process from the HTTP server.

import { startDigestWorker, agendarDigestCrons } from './digestQueue.ts'
import { startPubmedWorker } from './pubmedQueue.ts'
import { startCaseSeriesWorker } from './caseSeriesQueue.ts'
import { logger } from './_core/logger.ts'

async function main() {
  logger.info('[workers] Iniciando workers BullMQ...')

  startDigestWorker()
  startPubmedWorker()
  startCaseSeriesWorker()
  await agendarDigestCrons()

  logger.info('[workers] Workers prontos.')

  async function shutdown(signal: string) {
    logger.info(`[workers] ${signal} recebido — encerrando graciosamente...`)
    const { redis } = await import('./_core/redis.ts')
    await redis.quit().catch(() => undefined)
    logger.info('[workers] Encerrado.')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.error('[workers] Falha ao iniciar', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('[workers] unhandledRejection', { reason: String(reason) })
})
process.on('uncaughtException', (err) => {
  logger.error('[workers] uncaughtException', { error: (err as Error).message, stack: (err as Error).stack })
  process.exit(1)
})
