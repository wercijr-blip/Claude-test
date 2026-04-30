// Standalone entry point for BullMQ workers.
// Run with: tsx server/workers.ts
// In Railway: configure a second service with this command so workers
// run in a separate process from the HTTP server.

import { startPdfWorker, startLembreteWorker, startPesquisaWorker, startLinkAcessoWorker, agendarLembreteDiario } from './pdfQueue.ts'
import { startExamWorker } from './examQueue.ts'
import { logger } from './_core/logger.ts'

async function main() {
  logger.info('[workers] Iniciando workers BullMQ...')

  startPdfWorker()
  startLembreteWorker()
  startPesquisaWorker()
  startLinkAcessoWorker()
  startExamWorker()
  await agendarLembreteDiario()

  logger.info('[workers] Workers prontos.')

  async function shutdown(signal: string) {
    console.log(`[workers] ${signal} recebido — encerrando graciosamente...`)
    const { redis } = await import('./_core/redis.ts')
    await redis.quit().catch(() => undefined)
    console.log('[workers] Encerrado.')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  logger.error('[workers] Falha ao iniciar', err)
  process.exit(1)
})
