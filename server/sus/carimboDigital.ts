/**
 * Desenha o carimbo digital do médico + QR Code de verificação no PDF.
 *
 * O carimbo é a parte VISÍVEL do documento — funciona em conjunto com a
 * assinatura criptográfica ICP-Brasil aplicada por server/pdfSigner.ts.
 * O carimbo deve ser desenhado ANTES da assinatura (faz parte do conteúdo
 * que será assinado).
 */

import QRCode from 'qrcode'
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib'
import { env } from '../_core/env.ts'

export interface CarimboInfo {
  medicoNome: string
  crmTipo: string         // 'CRM'
  crmUf: string           // 'DF'
  crmNumero: string       // '16381'
  /** URL ou identificador para verificar o documento (vai no QR code) */
  verificationUrl: string
  /** Data e hora da emissão (formato dd/mm/yyyy HH:mm) */
  emitidoEm?: string
}

interface AreaCarimbo {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Desenha o carimbo na área especificada da página.
 * O QR code fica à direita (quadrado) e os dados do médico à esquerda.
 */
export async function desenharCarimboDigital(
  pdfDoc: PDFDocument,
  page: PDFPage,
  area: AreaCarimbo,
  info: CarimboInfo,
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // QR code à direita (quadrado, do tamanho da altura - 4 de margem)
  const qrSize = Math.min(area.height - 4, area.width - 100)
  const qrX = area.x + area.width - qrSize - 2
  const qrY = area.y + 2

  // Gera o QR code como PNG bytes
  const qrPng = await QRCode.toBuffer(info.verificationUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 200,
    color: { dark: '#000000', light: '#ffffff' },
  })
  const qrImage = await pdfDoc.embedPng(qrPng)
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })

  // Texto à esquerda — bloco do médico
  const textX = area.x + 4
  const textRight = qrX - 6
  const blockTop = area.y + area.height - 4
  let cursorY = blockTop

  const drawLine = (text: string, size: number, bold = false) => {
    cursorY -= size + 1
    page.drawText(text, {
      x: textX, y: cursorY, size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
      maxWidth: textRight - textX,
    })
  }

  drawLine('Assinado digitalmente', 6, false)
  drawLine(info.medicoNome.toUpperCase(), 8, true)
  drawLine(`${info.crmTipo}/${info.crmUf} ${info.crmNumero}`, 7, true)
  if (info.emitidoEm) drawLine(`Emitido em ${info.emitidoEm}`, 6, false)
  drawLine('ICP-Brasil · CFM 2.299/2021', 5, false)

  // Borda fina
  page.drawRectangle({
    x: area.x, y: area.y, width: area.width, height: area.height,
    borderColor: rgb(0.6, 0.6, 0.6),
    borderWidth: 0.5,
  })
}

/** Helper que monta o objeto CarimboInfo a partir das ENV vars + paciente. */
export function carimboFromEnv(pacienteId: number, tipoDoc: string): CarimboInfo {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const yyyy = now.getFullYear()
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')

  return {
    medicoNome: env.MEDICO_NOME,
    crmTipo: env.MEDICO_CRM_TIPO,
    crmUf: env.MEDICO_CRM_UF,
    crmNumero: env.MEDICO_CRM,
    verificationUrl: `${env.APP_URL}/v/${tipoDoc}-${pacienteId}`,
    emitidoEm: `${dd}/${mm}/${yyyy} ${hh}:${min}`,
  }
}
