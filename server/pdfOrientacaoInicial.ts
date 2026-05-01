/**
 * Documento de Orientação Inicial — gerado JUNTO com os pedidos de exame
 * (antes de iniciar a PrEP). Diferente do Documento de Orientação Final
 * (gerado ao término do fluxo, em pdfOrientacao.ts).
 *
 * Este aqui orienta o paciente que ainda vai fazer os exames pra iniciar
 * a PrEP. Mensagem central:
 *   - HIV é OBRIGATÓRIO (sem ele não dá pra iniciar a PrEP)
 *   - IST e Função renal/hepática são RECOMENDADOS (mas não obrigatórios)
 *   - SEM densitometria (paciente ainda não está em uso de TDF)
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { CLINICA_INFO } from '../shared/const.ts'
import {
  desenharCabecalhoInstitucional,
  desenharBannerTitulo,
  desenharBlocoPaciente,
  type DadosPaciente,
} from './pdfHeader.ts'
import { desenharCarimboDigital, carimboFromEnv } from './sus/carimboDigital.ts'

export interface DadosOrientacaoInicial {
  /** tokenId — usado no QR code (paciente ainda não tem pacienteId) */
  tokenId: number
  paciente: DadosPaciente
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50

const COR_TITULO = rgb(0.45, 0.36, 0.62)
const COR_LABEL = rgb(0.4, 0.4, 0.45)
const COR_TEXTO = rgb(0.15, 0.15, 0.2)
const COR_OBRIGATORIO = rgb(0.78, 0.27, 0.32)    // vermelho destaque
const COR_RECOMENDADO = rgb(0.18, 0.55, 0.34)    // verde
const COR_LINHA = rgb(0.88, 0.86, 0.92)

export async function gerarOrientacaoInicialPdf(dados: DadosOrientacaoInicial): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)
  void fontItalic

  const page = doc.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - 60

  const carimbo = carimboFromEnv('orientacao_inicial', dados.tokenId)

  // Cabeçalho institucional
  y = desenharCabecalhoInstitucional({
    doc, page, font, fontBold, pageWidth: PAGE_W, margin: MARGIN, startY: y + 60,
  })

  // Banner destacado
  y = desenharBannerTitulo({
    page, font, fontBold, pageWidth: PAGE_W, margin: MARGIN, startY: y,
    titulo: 'ORIENTAÇÃO PARA INÍCIO DA PrEP',
    subtitulo: 'Antes de iniciar a profilaxia — entenda os exames solicitados',
  })

  // Bloco do paciente
  y = desenharBlocoPaciente({
    page, font, fontBold, pageWidth: PAGE_W, margin: MARGIN, startY: y, paciente: dados.paciente,
  })

  // ── Seção 1: Por que estes exames? ──
  y = secao(page, fontBold, y, 'POR QUE PRECISO FAZER ESTES EXAMES?')
  y = paragrafo(page, font, y,
    'A PrEP (Profilaxia Pré-Exposição ao HIV) é um medicamento seguro e eficaz, mas ' +
    'antes de iniciar precisamos garantir que você está apto(a) a tomá-la. Por isso ' +
    'pedimos alguns exames laboratoriais que avaliam sua saúde geral e descartam ' +
    'condições que poderiam contraindicar o uso.',
  )
  y -= 8

  // ── Seção 2: Exame OBRIGATÓRIO ──
  y = secao(page, fontBold, y, 'EXAME OBRIGATÓRIO')

  // Caixa vermelha de destaque
  page.drawRectangle({
    x: MARGIN, y: y - 56, width: PAGE_W - MARGIN * 2, height: 60,
    color: rgb(1, 0.96, 0.94), borderColor: COR_OBRIGATORIO, borderWidth: 1.2,
  })
  page.drawText('!', { x: MARGIN + 12, y: y - 18, font: fontBold, size: 18, color: COR_OBRIGATORIO })
  page.drawText('Anti-HIV (1ª, 2ª ou 3ª/4ª geração)', {
    x: MARGIN + 30, y: y - 16, font: fontBold, size: 11, color: COR_OBRIGATORIO,
  })
  page.drawText(
    'Sem este exame não conseguimos iniciar a PrEP. Se o resultado for positivo, você',
    { x: MARGIN + 30, y: y - 30, font, size: 9, color: COR_TEXTO },
  )
  page.drawText(
    'será encaminhado(a) para tratamento adequado (a PrEP é apenas para pessoas HIV-negativas).',
    { x: MARGIN + 30, y: y - 42, font, size: 9, color: COR_TEXTO },
  )
  y -= 70

  // ── Seção 3: Exames RECOMENDADOS ──
  y = secao(page, fontBold, y, 'EXAMES RECOMENDADOS')
  y = paragrafo(page, font, y,
    'Embora não sejam obrigatórios para iniciar a PrEP, recomendamos fortemente que você ' +
    'realize os demais exames solicitados:',
  )

  y = itemRecomendado(page, font, fontBold, y, 'Sorológicos de IST',
    'Sífilis, Hepatites A/B/C, Clamídia, Gonorreia, Mycoplasma, Ureaplasma. ' +
    'Importante para sua saúde sexual integral — ISTs podem ser tratadas precocemente.')

  y = itemRecomendado(page, font, fontBold, y, 'Função renal (creatinina, ureia, EAS)',
    'O Tenofovir (TDF), medicamento da PrEP, é eliminado pelos rins. Avaliar a função ' +
    'renal antes de iniciar é uma medida de segurança importante.')

  y = itemRecomendado(page, font, fontBold, y, 'Função hepática (TGO, TGP, gama GT)',
    'Avalia a saúde do fígado e descarta hepatites em atividade que poderiam interferir ' +
    'no uso seguro do medicamento.')
  y -= 6

  // ── Seção 4: Onde fazer ──
  y = secao(page, fontBold, y, 'ONDE FAZER OS EXAMES')
  y = paragrafo(page, font, y,
    'Você pode realizar os exames em qualquer laboratório particular ou pelo SUS — ' +
    'os pedidos enviados em PDF têm validade nacional e código TUSS.',
  )
  y -= 4

  // ── Seção 5: Próximos passos ──
  y = secao(page, fontBold, y, 'PRÓXIMOS PASSOS')
  for (const passo of [
    'Realize o exame Anti-HIV (e os recomendados, se possível) em um laboratório de sua escolha',
    'Após coletar o resultado, faça login novamente no Facilita PrEP',
    'Anexe o resultado do Anti-HIV (até 7 dias da coleta)',
    'Nossa IA + médico farão a validação rápida',
    'Se aprovado, você seguirá para o formulário e receberá sua receita PrEP digital',
  ]) {
    y = bullet(page, font, fontBold, y, passo)
  }
  y -= 6

  // ── Contato ──
  y = secao(page, fontBold, y, 'DÚVIDAS? FALE COM A GENTE')
  page.drawText(`${CLINICA_INFO.nomeFantasia} · ${CLINICA_INFO.telefone} · ${CLINICA_INFO.email}`, {
    x: MARGIN, y, font, size: 9, color: COR_TEXTO,
  })
  y -= 12
  page.drawText(`Médico responsável: ${CLINICA_INFO.responsavelTecnico} — ${CLINICA_INFO.crmRt}`, {
    x: MARGIN, y, font: fontBold, size: 9, color: COR_TITULO,
  })

  // Carimbo digital
  await desenharCarimboDigital(doc, page,
    { x: MARGIN, y: 8, width: PAGE_W - MARGIN * 2, height: 60 },
    carimbo,
  )

  return Buffer.from(await doc.save())
}

// ── Helpers de desenho ────────────────────────────────────────

function secao(page: PDFPage, fontBold: PDFFont, y: number, titulo: string): number {
  page.drawLine({
    start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 },
    thickness: 1, color: COR_LINHA,
  })
  page.drawText(titulo, { x: MARGIN, y, font: fontBold, size: 11, color: COR_TITULO })
  return y - 18
}

function paragrafo(page: PDFPage, font: PDFFont, y: number, texto: string): number {
  const maxW = PAGE_W - MARGIN * 2
  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linha = ''
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p
    if (font.widthOfTextAtSize(teste, 9) > maxW) { linhas.push(linha); linha = p }
    else linha = teste
  }
  if (linha) linhas.push(linha)
  for (const l of linhas) {
    page.drawText(l, { x: MARGIN, y, font, size: 9, color: COR_TEXTO })
    y -= 12
  }
  return y - 4
}

function itemRecomendado(
  page: PDFPage, font: PDFFont, fontBold: PDFFont, y: number, nome: string, descricao: string,
): number {
  // Quadradinho verde como check
  page.drawRectangle({ x: MARGIN + 1, y: y - 1, width: 8, height: 8, color: COR_RECOMENDADO })
  page.drawText(nome, { x: MARGIN + 16, y, font: fontBold, size: 9, color: COR_TEXTO })
  y -= 12
  // Descrição com word wrap manual
  const maxW = PAGE_W - MARGIN * 2 - 16
  const palavras = descricao.split(' ')
  const linhas: string[] = []
  let linha = ''
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p
    if (font.widthOfTextAtSize(teste, 8.5) > maxW) { linhas.push(linha); linha = p }
    else linha = teste
  }
  if (linha) linhas.push(linha)
  for (const l of linhas) {
    page.drawText(l, { x: MARGIN + 16, y, font, size: 8.5, color: COR_LABEL })
    y -= 11
  }
  return y - 3
}

function bullet(
  page: PDFPage, font: PDFFont, _fontBold: PDFFont, y: number, texto: string,
): number {
  const maxW = PAGE_W - MARGIN * 2 - 12
  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linha = ''
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p
    if (font.widthOfTextAtSize(teste, 9) > maxW) { linhas.push(linha); linha = p }
    else linha = teste
  }
  if (linha) linhas.push(linha)
  page.drawText('•', { x: MARGIN + 2, y, font, size: 10, color: COR_TITULO })
  for (const l of linhas) {
    page.drawText(l, { x: MARGIN + 12, y, font, size: 9, color: COR_TEXTO })
    y -= 12
  }
  return y
}
