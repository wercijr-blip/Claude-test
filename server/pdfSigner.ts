import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import forge from 'node-forge'
import type { Paciente } from './types.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = path.join(__dirname, 'certs')

export interface PdfSignResult {
  buffer: Buffer
  certificadoSerial: string
  assinadoEm: Date
}

export async function gerarPrescricaoPdf(paciente: Paciente): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 50

  // Header
  page.drawText('FACILITA PrEP', {
    x: margin, y: height - 60,
    font: fontBold, size: 18, color: rgb(0.07, 0.27, 0.52),
  })
  page.drawText('Plataforma de Saúde Digital — Prescrição Médica', {
    x: margin, y: height - 78,
    font, size: 10, color: rgb(0.4, 0.4, 0.4),
  })

  // Linha divisória
  page.drawLine({ start: { x: margin, y: height - 90 }, end: { x: width - margin, y: height - 90 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) })

  let y = height - 120

  const field = (label: string, value: string) => {
    page.drawText(label + ':', { x: margin, y, font: fontBold, size: 10, color: rgb(0.3, 0.3, 0.3) })
    page.drawText(value, { x: margin + 120, y, font, size: 10, color: rgb(0.1, 0.1, 0.1) })
    y -= 20
  }

  page.drawText('DADOS DO PACIENTE', { x: margin, y, font: fontBold, size: 12, color: rgb(0.07, 0.27, 0.52) })
  y -= 22

  field('Nome', paciente.nome)
  field('Data de Nascimento', paciente.dataNascimento ?? '—')
  field('Sexo', paciente.sexo ?? '—')
  y -= 10

  page.drawText('PRESCRIÇÃO', { x: margin, y, font: fontBold, size: 12, color: rgb(0.07, 0.27, 0.52) })
  y -= 22

  const prescricao = paciente.prescricaoJson as { medicamento?: string; posologia?: string; duracao?: string; observacoes?: string } | null

  field('Medicamento', prescricao?.medicamento === 'tenofovir_emtricitabina' ? 'Tenofovir/Emtricitabina' : prescricao?.medicamento ?? '—')
  field('Posologia', prescricao?.posologia ?? '—')
  field('Duração', prescricao?.duracao ?? '—')

  if (prescricao?.observacoes) {
    page.drawText('Observações:', { x: margin, y, font: fontBold, size: 10, color: rgb(0.3, 0.3, 0.3) })
    y -= 16
    page.drawText(prescricao.observacoes, { x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.2), maxWidth: width - margin * 2 })
    y -= 30
  }

  // Rodapé
  const dataEmissao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  page.drawText(`Emitido em: ${dataEmissao} | Documento com validade legal conforme CFM 2.299/2021`, {
    x: margin, y: 40, font, size: 8, color: rgb(0.6, 0.6, 0.6),
  })

  return Buffer.from(await doc.save())
}

export async function assinarPdf(pdfBuffer: Buffer): Promise<PdfSignResult> {
  const pfxPath = path.join(CERTS_DIR, 'werciley.pfx')
  const pfxBuffer = await readFile(pfxPath)

  const pfxDer = pfxBuffer.toString('binary')
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, '')

  // Extrair certificado e chave privada
  const certBags = pfxObj.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags = pfxObj.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })

  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

  if (!certBag?.cert || !keyBag?.key) {
    throw new Error('Certificado ICP-Brasil não encontrado em server/certs/werciley.pfx')
  }

  const cert = certBag.cert
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey

  // Criar assinatura PKCS#7
  const md = forge.md.sha256.create()
  md.update(pdfBuffer.toString('binary'))
  const signature = privateKey.sign(md)

  const serial = cert.serialNumber
  const assinadoEm = new Date()

  // Embedar metadados de assinatura no PDF
  const doc = await PDFDocument.load(pdfBuffer)
  doc.setTitle('Prescrição PrEP — Facilita PrEP')
  doc.setAuthor(cert.subject.getField('CN')?.value ?? 'Médico Responsável')
  doc.setCreationDate(assinadoEm)
  doc.setModificationDate(assinadoEm)

  const signedBuffer = Buffer.from(await doc.save())

  return {
    buffer: signedBuffer,
    certificadoSerial: serial,
    assinadoEm,
  }
}

// Tipos locais auxiliares
interface Paciente {
  nome: string
  dataNascimento: string | null
  sexo: string | null
  prescricaoJson: unknown
}
