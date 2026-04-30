// Standalone entry point for BullMQ workers.
// Run with: tsx server/workers.ts
// In Railway: configure a second service with this command so workers
// run in a separate process from the HTTP server.

import { startPdfWorker, startLembreteWorker, startPesquisaWorker, startLinkAcessoWorker, agendarLembreteDiario } from './pdfQueue.ts'
import { startExamWorker } from './examQueue.ts'

async function main() {
  console.log('[workers] Iniciando workers BullMQ...')

  startPdfWorker()
  startLembreteWorker()
  startPesquisaWorker()
  startLinkAcessoWorker()
  startExamWorker()
  await agendarLembreteDiario()

  console.log('[workers] Workers prontos.')

  // Keep the process alive
  process.on('SIGTERM', () => {
    console.log('[workers] SIGTERM recebido — encerrando graciosamente')
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[workers] Falha ao iniciar:', err)
  process.exit(1)
})
