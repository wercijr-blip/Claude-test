/**
 * Guia de Orientação ao Paciente PrEP — documento informativo gerado
 * junto com os outros PDFs ao final do fluxo. Contém:
 *  - Lista dos documentos digitais que o paciente recebeu
 *  - Instruções de retirada da medicação (particular e SUS)
 *  - Cronograma de exames de acompanhamento
 *  - Lembrete de como tomar a PrEP (varia conforme modalidade)
 *  - Sinais de alerta e contato da clínica
 *
 * Embora informativo, é assinado digitalmente para consistência (todo
 * documento gerado pela plataforma carrega assinatura ICP-Brasil).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { CLINICA_INFO, type PrepModalidade } from '../shared/const.ts'
import { desenharCabecalhoInstitucional, desenharBannerTitulo, desenharBlocoPaciente, type DadosPaciente } from './pdfHeader.ts'
import { desenharCarimboDigital, carimboFromEnv } from './sus/carimboDigital.ts'

export interface DadosOrientacao {
  pacienteId: number
  paciente: DadosPaciente
  /** Modalidade de PrEP escolhida — afeta a seção "Como tomar a PrEP" */
  prepModalidade: PrepModalidade
  /** 'primeiro_atendimento' | 'ja_faco_prep' — afeta lista de documentos */
  tipoConsulta: 'primeiro_atendimento' | 'ja_faco_prep'
  /** Quais pedidos de exame foram emitidos junto */
  pedidosEmitidos: {
    completo: boolean
    ist: boolean
    hiv: boolean
    densitometria: boolean
  }
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50
const MIN_Y = 80

const COR_TITULO = rgb(0.45, 0.36, 0.62)        // brand purple
const COR_LABEL = rgb(0.4, 0.4, 0.45)           // cinza médio
const COR_TEXTO = rgb(0.15, 0.15, 0.2)          // quase preto
const COR_DESTAQUE = rgb(0.78, 0.27, 0.32)      // vermelho atenção
const COR_SUAVE = rgb(0.5, 0.5, 0.55)
const COR_LINHA = rgb(0.88, 0.86, 0.92)

export async function gerarOrientacaoPdf(dados: DadosOrientacao): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)

  const novaPage = (): { page: PDFPage; y: number } => {
    const p = doc.addPage([PAGE_W, PAGE_H])
    return { page: p, y: PAGE_H - 60 }
  }

  let { page, y } = novaPage()
  const carimbo = carimboFromEnv('orientacao', dados.pacienteId)
  const desenharCarimboNaPagina = (p: PDFPage) =>
    desenharCarimboDigital(doc, p, { x: MARGIN, y: 8, width: PAGE_W - MARGIN * 2, height: 60 }, carimbo)

  const garanteEspaco = async (alturaNecessaria: number) => {
    if (y - alturaNecessaria < MIN_Y) {
      await desenharCarimboNaPagina(page)
      ;({ page, y } = novaPage())
    }
  }

  // ── Cabeçalho institucional (1ª página) ──
  y = desenharCabecalhoInstitucional({
    doc, page, font, fontBold, pageWidth: PAGE_W, margin: MARGIN, startY: y + 60,
  })

  // ── Banner destacado (mesmo helper usado nos pedidos de exame) ──
  y = desenharBannerTitulo({
    page, font, fontBold, pageWidth: PAGE_W, margin: MARGIN, startY: y,
    titulo: 'DOCUMENTO DE ORIENTAÇÃO',
    subtitulo: 'Guia ao Usuário PrEP — leia com atenção e guarde para consulta futura',
  })
  // fontItalic não é mais usado — silencia warning
  void fontItalic

  // ── Bloco do paciente ──
  y = desenharBlocoPaciente({
    page, font, fontBold, pageWidth: PAGE_W, margin: MARGIN, startY: y, paciente: dados.paciente,
  })

  // ───────────────────────────────────────────────────────────────
  // Seção 1: Documentos recebidos
  // ───────────────────────────────────────────────────────────────
  y = await desenharSecao(page, font, fontBold, y, 'DOCUMENTOS QUE VOCÊ RECEBEU')
  y = desenharParagrafo(page, font, y,
    'Junto deste guia você recebeu os seguintes documentos digitais, todos assinados ' +
    'com certificado ICP-Brasil (validade jurídica nacional — Resolução CFM 2.299/2021 ' +
    'e Medida Provisória 2.200-2/2001):',
  )
  y -= 4

  const docsRecebidos: { nome: string; descricao: string }[] = []
  docsRecebidos.push({
    nome: 'Receita PrEP',
    descricao: 'Apresente em qualquer farmácia ou na UDM do SUS para retirar o medicamento.',
  })
  if (dados.tipoConsulta === 'primeiro_atendimento') {
    docsRecebidos.push({
      nome: 'Cadastro de Usuário SUS PrEP',
      descricao: 'Necessário apenas na primeira retirada na UDM do SUS.',
    })
  }
  docsRecebidos.push({
    nome: 'Ficha de Atendimento PrEP',
    descricao: 'Registra esta consulta — leve a cada retirada na UDM.',
  })
  if (dados.pedidosEmitidos.completo) {
    docsRecebidos.push({
      nome: 'Pedido de Exames Completo',
      descricao: 'Exames laboratoriais para avaliação clínica geral.',
    })
  }
  if (dados.pedidosEmitidos.hiv) {
    docsRecebidos.push({
      nome: 'Pedido de Anti-HIV',
      descricao: 'Use a cada 3 meses para acompanhamento (obrigatório antes da próxima retirada).',
    })
  }
  if (dados.pedidosEmitidos.ist) {
    docsRecebidos.push({
      nome: 'Pedido de Sorológicos IST',
      descricao: 'Sífilis, Hepatites, Clamídia, Gonorreia — repetir a cada 3 a 6 meses conforme exposição.',
    })
  }
  if (dados.pedidosEmitidos.densitometria) {
    docsRecebidos.push({
      nome: 'Pedido de Densitometria Óssea',
      descricao: 'Uso contínuo de Tenofovir (TDF) — repetir anualmente.',
    })
  }

  for (const d of docsRecebidos) {
    await garanteEspaco(28)
    y = desenharItemDocumento(page, font, fontBold, y, d.nome, d.descricao)
  }
  y -= 8

  // ───────────────────────────────────────────────────────────────
  // Seção 2: Como retirar o medicamento
  // ───────────────────────────────────────────────────────────────
  await garanteEspaco(80)
  y = await desenharSecao(page, font, fontBold, y, 'COMO RETIRAR SUA MEDICAÇÃO')

  // 2A — Farmácia particular
  y = desenharSubsecao(page, fontBold, y, 'Opção 1 — Farmácia particular')
  y = desenharParagrafo(page, font, y,
    'Apresente a Receita PrEP em qualquer farmácia ou drogaria do Brasil. A assinatura ' +
    'ICP-Brasil tem validade nacional — você pode comprar onde for mais conveniente.',
  )
  y -= 8

  // 2B — SUS / UDM
  await garanteEspaco(140)
  y = desenharSubsecao(page, fontBold, y, 'Opção 2 — Rede pública (SUS) — gratuito')
  y = desenharParagrafo(page, font, y,
    'Compareça à Unidade Dispensadora de Medicamentos (UDM) levando os documentos abaixo. ' +
    'Encontre a UDM mais próxima em: azt.aids.gov.br',
  )
  y -= 4

  // Checklists
  y = desenharSubItem(page, fontBold, y, 'Primeira retirada:', COR_TITULO)
  for (const item of [
    'Cadastro de Usuário SUS PrEP (gerado pelo Facilita PrEP)',
    'Receita PrEP (gerada pelo Facilita PrEP)',
    'Ficha de Atendimento PrEP (gerada pelo Facilita PrEP)',
    'Resultado do exame Anti-HIV recente (até 7 dias)',
    'Documento oficial com foto',
  ]) {
    await garanteEspaco(14)
    y = desenharBullet(page, font, y, item)
  }
  y -= 6

  y = desenharSubItem(page, fontBold, y, 'Próximas retiradas:', COR_TITULO)
  for (const item of [
    'Receita PrEP',
    'Ficha de Atendimento PrEP da consulta atual',
    'Resultado do exame Anti-HIV recente (até 7 dias)',
    'Documento oficial com foto',
  ]) {
    await garanteEspaco(14)
    y = desenharBullet(page, font, y, item)
  }
  y -= 8

  // ───────────────────────────────────────────────────────────────
  // Seção 3: Cronograma de exames
  // ───────────────────────────────────────────────────────────────
  await garanteEspaco(160)
  y = await desenharSecao(page, font, fontBold, y, 'CRONOGRAMA DE EXAMES')

  const cronograma: { exame: string; freq: string }[] = [
    { exame: 'Anti-HIV (4ª geração)',                  freq: 'A cada 3 meses (obrigatório antes de cada retirada)' },
    { exame: 'Sorológicos IST',                        freq: 'A cada 3 a 6 meses, conforme exposição' },
    { exame: 'Função renal (creatinina, ureia, EAS)',  freq: 'A cada 6 meses durante uso de TDF' },
    { exame: 'Função hepática (TGO, TGP, gama GT)',    freq: 'A cada 6 meses' },
    { exame: 'Densitometria óssea',                    freq: 'A cada 12 meses durante uso de TDF' },
    { exame: 'Hepatite B (HBsAg, Anti-HBs)',           freq: 'No início — verificar imunidade/vacinação' },
  ]
  for (const c of cronograma) {
    await garanteEspaco(16)
    y = desenharLinhaCronograma(page, font, fontBold, y, c.exame, c.freq)
  }
  y -= 8
  y = desenharAlerta(page, font, fontBold, y,
    'IMPORTANTE: o resultado Anti-HIV recente (até 7 dias) é obrigatório para a próxima retirada na UDM.',
  )
  y -= 8

  // ───────────────────────────────────────────────────────────────
  // Seção 4: Como tomar a PrEP
  // ───────────────────────────────────────────────────────────────
  await garanteEspaco(120)
  y = await desenharSecao(page, font, fontBold, y, 'COMO TOMAR A PrEP')
  y = desenharSubsecao(page, fontBold, y, `Sua modalidade: ${dados.prepModalidade}`)

  if (dados.prepModalidade === 'PrEP diária') {
    for (const item of [
      '1 comprimido todos os dias, em horário fixo',
      'Proteção máxima após 7 dias (sexo anal) ou 20 dias (sexo vaginal)',
      'Não interrompa sem orientação médica',
      'Se esquecer uma dose: tome assim que lembrar (até 12h depois). Pulou mais de um dia? Procure orientação',
    ]) {
      await garanteEspaco(14)
      y = desenharBullet(page, font, y, item)
    }
  } else {
    for (const item of [
      '2 comprimidos: 2 a 24 horas antes da relação sexual',
      '1 comprimido: 24 horas após a 1ª dose',
      '1 comprimido: 48 horas após a 1ª dose',
      'Total: 4 comprimidos por episódio sexual',
      'Se houver novas relações nos dias seguintes: continue com 1 comp/dia até 48h após a última',
      'NÃO use este esquema se for: mulher cis, pessoa trans em uso de hormônios, ou tiver hepatite B/rim alterado',
    ]) {
      await garanteEspaco(14)
      y = desenharBullet(page, font, y, item)
    }
  }
  y -= 8

  // ───────────────────────────────────────────────────────────────
  // Seção 5: Sinais de alerta
  // ───────────────────────────────────────────────────────────────
  await garanteEspaco(140)
  y = await desenharSecao(page, font, fontBold, y, 'SINAIS DE ALERTA — PROCURE ATENDIMENTO')
  for (const item of [
    'Sintomas gripais (febre, gânglios, garganta) nas primeiras 4 semanas — pode indicar infecção pelo HIV',
    'Dor abdominal forte, urina escura ou olhos amarelados — possível alteração hepática',
    'Vômito persistente ou diarreia por mais de 7 dias',
    'Esquecer doses por mais de 3 dias seguidos',
    'Reação alérgica (urticária, inchaço, falta de ar)',
    'Sintomas urinários ou corrimento — pode ser IST',
  ]) {
    await garanteEspaco(14)
    y = desenharBullet(page, font, y, item)
  }
  y -= 8

  // ───────────────────────────────────────────────────────────────
  // Seção 6: Contato
  // ───────────────────────────────────────────────────────────────
  await garanteEspaco(110)
  y = await desenharSecao(page, font, fontBold, y, 'CONTATO DA CLÍNICA')

  page.drawText(CLINICA_INFO.nomeFantasia, { x: MARGIN, y, font: fontBold, size: 10, color: COR_TEXTO })
  y -= 13
  page.drawText(`${CLINICA_INFO.endereco}`, { x: MARGIN, y, font, size: 9, color: COR_TEXTO })
  y -= 11
  page.drawText(`${CLINICA_INFO.bairroCidadeUf} · CEP ${CLINICA_INFO.cep}`, { x: MARGIN, y, font, size: 9, color: COR_TEXTO })
  y -= 13
  page.drawText(`Telefone: ${CLINICA_INFO.telefone}`, { x: MARGIN, y, font, size: 9, color: COR_TEXTO })
  y -= 11
  page.drawText(`E-mail: ${CLINICA_INFO.email}`, { x: MARGIN, y, font, size: 9, color: COR_TEXTO })
  y -= 13
  page.drawText(`Médico responsável técnico: ${CLINICA_INFO.responsavelTecnico} — ${CLINICA_INFO.crmRt}`, {
    x: MARGIN, y, font: fontBold, size: 9, color: COR_TITULO,
  })

  // ── Carimbo digital + QR Code na última página ──
  await desenharCarimboNaPagina(page)

  return Buffer.from(await doc.save())
}

// ───────────────────────────────────────────────────────────────
// Helpers de desenho
// ───────────────────────────────────────────────────────────────

async function desenharSecao(
  page: PDFPage, font: PDFFont, fontBold: PDFFont, y: number, titulo: string,
): Promise<number> {
  page.drawLine({
    start: { x: MARGIN, y: y + 8 }, end: { x: PAGE_W - MARGIN, y: y + 8 },
    thickness: 1, color: COR_LINHA,
  })
  page.drawText(titulo, { x: MARGIN, y, font: fontBold, size: 11, color: COR_TITULO })
  return y - 18
}

function desenharSubsecao(page: PDFPage, fontBold: PDFFont, y: number, texto: string): number {
  page.drawText(texto, { x: MARGIN, y, font: fontBold, size: 10, color: COR_TEXTO })
  return y - 16
}

function desenharSubItem(page: PDFPage, fontBold: PDFFont, y: number, texto: string, color = COR_LABEL): number {
  page.drawText(texto, { x: MARGIN, y, font: fontBold, size: 9, color })
  return y - 14
}

function desenharParagrafo(page: PDFPage, font: PDFFont, y: number, texto: string): number {
  // Quebra simples por largura
  const maxW = PAGE_W - MARGIN * 2
  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linha = ''
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p
    if (font.widthOfTextAtSize(teste, 9) > maxW) {
      linhas.push(linha)
      linha = p
    } else {
      linha = teste
    }
  }
  if (linha) linhas.push(linha)
  for (const l of linhas) {
    page.drawText(l, { x: MARGIN, y, font, size: 9, color: COR_TEXTO })
    y -= 12
  }
  return y - 2
}

function desenharBullet(page: PDFPage, font: PDFFont, y: number, texto: string): number {
  const maxW = PAGE_W - MARGIN * 2 - 12
  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linha = ''
  for (const p of palavras) {
    const teste = linha ? `${linha} ${p}` : p
    if (font.widthOfTextAtSize(teste, 9) > maxW) { linhas.push(linha); linha = p }
    else { linha = teste }
  }
  if (linha) linhas.push(linha)
  page.drawText('•', { x: MARGIN + 2, y, font, size: 10, color: COR_TITULO })
  for (let i = 0; i < linhas.length; i++) {
    page.drawText(linhas[i], { x: MARGIN + 12, y, font, size: 9, color: COR_TEXTO })
    y -= 12
  }
  return y
}

function desenharLinhaCronograma(
  page: PDFPage, font: PDFFont, fontBold: PDFFont, y: number, exame: string, freq: string,
): number {
  page.drawText(exame, { x: MARGIN, y, font: fontBold, size: 9, color: COR_TEXTO })
  page.drawText(freq, { x: MARGIN + 200, y, font, size: 9, color: COR_LABEL })
  return y - 13
}

function desenharItemDocumento(
  page: PDFPage, font: PDFFont, fontBold: PDFFont, y: number, nome: string, descricao: string,
): number {
  // Quadradinho verde como "checkmark" (Helvetica/WinAnsi não suporta ✓)
  page.drawRectangle({ x: MARGIN + 1, y: y - 1, width: 8, height: 8, color: rgb(0.18, 0.55, 0.34) })
  page.drawText(nome, { x: MARGIN + 16, y, font: fontBold, size: 9, color: COR_TEXTO })
  y -= 11
  page.drawText(descricao, { x: MARGIN + 16, y, font, size: 8, color: COR_LABEL, maxWidth: PAGE_W - MARGIN * 2 - 16 })
  return y - 13
}

function desenharAlerta(
  page: PDFPage, font: PDFFont, fontBold: PDFFont, y: number, texto: string,
): number {
  page.drawRectangle({
    x: MARGIN, y: y - 24, width: PAGE_W - MARGIN * 2, height: 28,
    color: rgb(1, 0.96, 0.92), borderColor: COR_DESTAQUE, borderWidth: 0.6,
  })
  page.drawText('!', { x: MARGIN + 8, y: y - 14, font: fontBold, size: 12, color: COR_DESTAQUE })
  page.drawText(texto, {
    x: MARGIN + 22, y: y - 14, font, size: 8.5, color: COR_DESTAQUE,
    maxWidth: PAGE_W - MARGIN * 2 - 30,
  })
  return y - 32
}
