// Re-export shim — implementation moved to server/workers/.
// Existing importers continue to work unchanged.
export {
  PDF_QUEUE_NAME, LEMBRETE_QUEUE_NAME, PESQUISA_QUEUE_NAME, LINK_ACESSO_QUEUE_NAME,
  pdfQueue, lembreteQueue, pesquisaQueue, linkAcessoQueue,
} from './workers/queues.ts'
export { enqueueGerarPdf, startPdfWorker } from './workers/pdfWorker.ts'
export { startPesquisaWorker } from './workers/pesquisaWorker.ts'
export { startLembreteWorker, agendarLembreteDiario, agendarDrMensal } from './workers/lembreteWorker.ts'
export { startLinkAcessoWorker, enqueueEnviarLinkAcesso } from './workers/linkAcessoWorker.ts'
