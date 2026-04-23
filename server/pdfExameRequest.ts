import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
  EXAMES_PRIMEIRO_ATENDIMENTO,
  EXAMES_FOLLOWUP_PREP,
  EXAMES_HIV_ISOLADO,
  EXAMES_SOROLOGICOS_IST,
  EXAMES_DENSITOMETRIA,
  type Exame,
} from '../shared/const.ts'
import { desenharCarimboICP } from './pdfSigner.ts'

async function gerarPdfPedido(
  exames: readonly Exame[],
  titulo: string,
  subtitulo: string,
  nomePaciente: string,
  observacao?: string,
): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const PAGE_W = 595
  const PAGE_H = 842
  const margin = 50
  // y mínimo antes de iniciar nova página (reserva rodapé)
  const MIN_Y = 80

  // Adiciona nova página e retorna referência + cursor inicial
  const novaPage = () => {
    const p = doc.addPage([PAGE_W, PAGE_H])
    return { page: p, y: PAGE_H - 60 }
  }

  let { page, y } = novaPage()

  // Header (primeira página)
  page.drawText('FACILITA PrEP', { x: margin, y, font: fontBold, size: 18, color: rgb(0.07, 0.27, 0.52) })
  y -= 22
  page.drawText('Plataforma de Saúde Digital — Pedido de Exames', { x: margin, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 14
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })
  y -= 24

  // Título
  page.drawText(titulo, { x: margin, y, font: fontBold, size: 14, color: rgb(0.07, 0.27, 0.52) })
  y -= 18
  page.drawText(subtitulo, { x: margin, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 28

  // Paciente
  page.drawText('PACIENTE', { x: margin, y, font: fontBold, size: 11, color: rgb(0.3, 0.3, 0.3) })
  y -= 18
  page.drawText(nomePaciente, { x: margin, y, font, size: 11, color: rgb(0.1, 0.1, 0.1) })
  y -= 10
  page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) })
  y -= 24

  // Lista de exames
  page.drawText('EXAMES SOLICITADOS', { x: margin, y, font: fontBold, size: 11, color: rgb(0.3, 0.3, 0.3) })
  y -= 20

  for (const exame of exames) {
    // Quebra de página quando o espaço acabar
    if (y < MIN_Y) {
      desenharCarimboICP(page, font, fontBold, PAGE_W, margin)
      ;({ page, y } = novaPage())
      // Cabeçalho de continuação
      page.drawText(`${titulo} (continuação)`, { x: margin, y, font: fontBold, size: 11, color: rgb(0.07, 0.27, 0.52) })
      y -= 14
      page.drawLine({ start: { x: margin, y }, end: { x: PAGE_W - margin, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
      y -= 20
    }
    page.drawText(`•  ${exame.nome}`, { x: margin + 8, y, font, size: 10, color: rgb(0.1, 0.1, 0.1) })
    page.drawText(`TUSS ${exame.tuss}`, { x: PAGE_W - margin - 90, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
    y -= 18
  }

  if (observacao) {
    if (y < MIN_Y + 40) {
      desenharCarimboICP(page, font, fontBold, PAGE_W, margin)
      ;({ page, y } = novaPage())
    }
    y -= 8
    page.drawText('OBSERVAÇÃO', { x: margin, y, font: fontBold, size: 9, color: rgb(0.5, 0.5, 0.5) })
    y -= 14
    page.drawText(observacao, { x: margin, y, font, size: 9, color: rgb(0.4, 0.4, 0.4), maxWidth: PAGE_W - margin * 2 })
  }

  // Data de emissão + carimbo digital na última página
  const dataEmissao = new Date().toLocaleDateString('pt-BR')
  page.drawText(`Data de emissão: ${dataEmissao}`, { x: margin, y: 62, font, size: 8, color: rgb(0.5, 0.5, 0.5) })
  desenharCarimboICP(page, font, fontBold, PAGE_W, margin)

  return Buffer.from(await doc.save())
}

export async function gerarPedidosExames(
  tipoConsulta: 'primeiro_atendimento' | 'ja_faco_prep',
  nomePaciente: string,
): Promise<{ completo: Buffer; ist: Buffer; hiv: Buffer; densitometria: Buffer }> {
  const examesCompleto = tipoConsulta === 'primeiro_atendimento'
    ? EXAMES_PRIMEIRO_ATENDIMENTO
    : EXAMES_FOLLOWUP_PREP

  const subtituloCompleto = tipoConsulta === 'primeiro_atendimento'
    ? 'Triagem inicial para início da PrEP'
    : 'Acompanhamento semestral — PrEP em uso'

  const [completo, ist, hiv, densitometria] = await Promise.all([
    gerarPdfPedido(
      examesCompleto,
      'Pedido de Exames Completo',
      subtituloCompleto,
      nomePaciente,
    ),
    gerarPdfPedido(
      EXAMES_SOROLOGICOS_IST,
      'Pedido de Exames Sorológicos de IST',
      'Infecções sexualmente transmissíveis — rastreamento PrEP',
      nomePaciente,
    ),
    gerarPdfPedido(
      EXAMES_HIV_ISOLADO,
      'Pedido de Exame Anti-HIV',
      'Anti-HIV 1/2 com Ag p24 — 4ª geração',
      nomePaciente,
    ),
    gerarPdfPedido(
      EXAMES_DENSITOMETRIA,
      'Pedido de Densitometria Óssea',
      'Monitoramento de densidade mineral óssea — uso de Tenofovir (TDF)',
      nomePaciente,
      'Indicado para monitoramento de pacientes em uso de Tenofovir Disoproxil Fumarato (TDF). Repetir a cada 12 meses.',
    ),
  ])

  return { completo, ist, hiv, densitometria }
}
