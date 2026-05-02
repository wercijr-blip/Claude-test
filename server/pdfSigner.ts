import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import forge from 'node-forge'
import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'
import { plainAddPlaceholder } from '@signpdf/placeholder-plain'
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils'
import { env } from './_core/env.ts'
import { desenharCarimboDigital, carimboFromEnv } from './sus/carimboDigital.ts'
import {
  desenharCabecalhoInstitucional,
  desenharBannerTitulo,
  desenharBlocoPaciente,
  desenharIndicacaoCID,
  drawTextWrapped,
} from './pdfHeader.ts'
import { formatarCpf } from './_core/cpfValidator.ts'

const signpdf = new SignPdf()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CERTS_DIR = path.join(__dirname, 'certs')

export interface PdfSignResult {
  buffer: Buffer
  certificadoSerial: string
  assinadoEm: Date
}

export async function gerarPrescricaoPdf(paciente: Paciente & { pacienteId?: number; cpf?: string | null }): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const PAGE_W = 595
  const PAGE_H = 842
  const page = doc.addPage([PAGE_W, PAGE_H])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const margin = 50

  // Cabeçalho institucional padronizado (mesmo layout dos pedidos de exame)
  let y = desenharCabecalhoInstitucional({
    doc, page, font, fontBold, pageWidth: PAGE_W, margin, startY: PAGE_H - 60 + 60,
  })

  // Banner roxo "RECEITA MÉDICA"
  const validadeDate = new Date()
  validadeDate.setMonth(validadeDate.getMonth() + 4)
  const dataValidade = validadeDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  y = desenharBannerTitulo({
    page, font, fontBold, pageWidth: PAGE_W, margin, startY: y,
    titulo: 'RECEITA MÉDICA',
    subtitulo: `Profilaxia Pré-Exposição (PrEP) ao HIV · Validade até ${dataValidade}`,
  })

  // Bloco do paciente (nome + CPF)
  y = desenharBlocoPaciente({
    page, font, fontBold, pageWidth: PAGE_W, margin, startY: y,
    paciente: { nome: paciente.nome, cpf: paciente.cpf },
  })

  // Bloco PRESCRIÇÃO
  const prescricao = paciente.prescricaoJson as { medicamento?: string; posologia?: string; duracao?: string; observacoes?: string } | null
  const medicamento = prescricao?.medicamento === 'tenofovir_emtricitabina'
    ? 'Tenofovir 300 mg + Entricitabina 200 mg (TDF/FTC)'
    : prescricao?.medicamento ?? '—'

  page.drawText('PRESCRIÇÃO', { x: margin, y, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.45) })
  y -= 16

  const linhaPrescricao = (label: string, value: string) => {
    page.drawText(`${label}:`, { x: margin, y, font: fontBold, size: 10, color: rgb(0.2, 0.2, 0.25) })
    const valueX = margin + 110
    const valueMaxW = PAGE_W - margin - valueX
    const yStart = y
    const yAfter = drawTextWrapped(page, value, {
      x: valueX, y, font, size: 10, color: rgb(0.1, 0.1, 0.15),
      maxWidth: valueMaxW, lineHeight: 14,
    })
    // garante pelo menos um avanço de 18pt mesmo se valor for vazio
    y = Math.min(yAfter - 4, yStart - 18)
  }

  linhaPrescricao('Medicamento', medicamento)
  linhaPrescricao('Posologia', prescricao?.posologia ?? '—')
  linhaPrescricao('Duração', prescricao?.duracao ?? '—')

  if (prescricao?.observacoes) {
    y -= 4
    page.drawText('Observações:', { x: margin, y, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.45) })
    y -= 13
    y = drawTextWrapped(page, prescricao.observacoes, {
      x: margin, y, font, size: 9, color: rgb(0.2, 0.2, 0.25),
      maxWidth: PAGE_W - margin * 2, lineHeight: 12,
    })
    y -= 4
  }

  // Indicação clínica + CID + validade (mesmo bloco dos pedidos)
  y = Math.max(y - 8, 160)
  desenharIndicacaoCID({
    page, font, fontBold, margin, pageWidth: PAGE_W, startY: y,
    indicacao: 'Profilaxia Pré-Exposição (PrEP) ao HIV — protocolo Ministério da Saúde 2024.',
    validadeDias: 120,
  })

  // Carimbo digital com QR Code (assinatura ICP-Brasil é aplicada por assinarPdf)
  const carimboPresc = carimboFromEnv('prescricao', paciente.pacienteId ?? 0)
  await desenharCarimboDigital(doc, page, { x: margin, y: 8, width: PAGE_W - margin * 2, height: 60 }, carimboPresc)

  return Buffer.from(await doc.save())
}

export interface PacienteCompleto {
  pacienteId?: number
  nome: string
  cpf?: string
  dataNascimento: string | null
  sexo: string | null
  nomeSocial?: string | null
  corRaca?: string | null
  escolaridade?: string | null
  situacaoConjugal?: string | null
  email?: string | null
  telefone?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  estado?: string | null
  tipoAtendimento?: string | null
  convenio?: string | null
  condutaJson: unknown
  prescricaoJson: unknown
}

export async function gerarFormularioPdf(paciente: PacienteCompleto): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const m = 50
  let y = height - 60

  const titulo = (txt: string) => {
    page.drawText(txt, { x: m, y, font: fontBold, size: 11, color: rgb(0.07, 0.27, 0.52) })
    y -= 6
    page.drawLine({ start: { x: m, y }, end: { x: width - m, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    y -= 16
  }

  const campo = (label: string, valor: string | null | undefined) => {
    const v = valor ?? '—'
    const maxW = width - m * 2 - 160
    page.drawText(label + ':', { x: m, y, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) })
    const yStart = y
    const yAfter = drawTextWrapped(page, v, {
      x: m + 160, y, font, size: 9, color: rgb(0.1, 0.1, 0.1),
      maxWidth: maxW, lineHeight: 12,
    })
    // mantém pelo menos 16pt de avanço (compatibilidade com layout existente)
    y = Math.min(yAfter - 4, yStart - 16)
  }

  // Header
  page.drawText('FACILITA PrEP', { x: m, y, font: fontBold, size: 18, color: rgb(0.07, 0.27, 0.52) })
  y -= 20
  page.drawText('Formulário Clínico PrEP', { x: m, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 12
  page.drawLine({ start: { x: m, y }, end: { x: width - m, y }, thickness: 1.5, color: rgb(0.07, 0.27, 0.52) })
  y -= 24

  titulo('1. DADOS PESSOAIS')
  campo('Nome completo', paciente.nome)
  if (paciente.cpf) campo('CPF', formatarCpf(paciente.cpf))
  campo('Data de nascimento', paciente.dataNascimento ? paciente.dataNascimento.split('-').reverse().join('/') : null)
  campo('Sexo biológico', paciente.sexo)
  if (paciente.nomeSocial) campo('Nome social', paciente.nomeSocial)
  y -= 8

  titulo('2. DADOS DEMOGRÁFICOS')
  campo('Cor/Raça', paciente.corRaca)
  campo('Escolaridade', paciente.escolaridade)
  campo('Situação conjugal', paciente.situacaoConjugal)
  y -= 8

  titulo('3. CONTATO')
  campo('E-mail', paciente.email)
  campo('Telefone', paciente.telefone)
  const end = [paciente.logradouro, paciente.numero, paciente.complemento, paciente.bairro, paciente.cidade, paciente.estado].filter(Boolean).join(', ')
  if (end) campo('Endereço', end)
  campo('CEP', paciente.cep)
  y -= 8

  const conduta = paciente.condutaJson as {
    relacoesSexuais?: { tipos?: string[]; frequencia?: string; parceirosUltimos6Meses?: number; usaPreservativo?: string }
    historicoDst?: boolean; dstDescricao?: string; prepAnterior?: boolean; prepPeriodo?: string
    usoDrogas?: boolean; drogasDescricao?: string; outrasInformacoes?: string
  } | null

  titulo('4. CONDUTA / HISTÓRICO')
  if (conduta) {
    campo('Práticas sexuais', conduta.relacoesSexuais?.tipos?.join(', '))
    campo('Frequência', conduta.relacoesSexuais?.frequencia)
    campo('Parceiros (6 meses)', conduta.relacoesSexuais?.parceirosUltimos6Meses != null ? String(conduta.relacoesSexuais.parceirosUltimos6Meses) : null)
    campo('Uso preservativo', conduta.relacoesSexuais?.usaPreservativo)
    campo('Histórico DST', conduta.historicoDst != null ? (conduta.historicoDst ? 'Sim' : 'Não') : null)
    if (conduta.dstDescricao) campo('DST — descrição', conduta.dstDescricao)
    campo('PrEP anterior', conduta.prepAnterior != null ? (conduta.prepAnterior ? 'Sim' : 'Não') : null)
    if (conduta.prepPeriodo) campo('Período PrEP', conduta.prepPeriodo)
    campo('Uso de drogas', conduta.usoDrogas != null ? (conduta.usoDrogas ? 'Sim' : 'Não') : null)
    if (conduta.drogasDescricao) campo('Drogas — descrição', conduta.drogasDescricao)
    if (conduta.outrasInformacoes) campo('Outras informações', conduta.outrasInformacoes)
  }
  y -= 8

  const prescricao = paciente.prescricaoJson as {
    medicamento?: string; nomeMedicamento?: string; posologia?: string; duracao?: string; observacoes?: string
  } | null

  titulo('5. PRESCRIÇÃO')
  if (prescricao) {
    const med = prescricao.medicamento === 'tenofovir_emtricitabina'
      ? 'Tenofovir/Emtricitabina (TDF+FTC)'
      : (prescricao.nomeMedicamento ?? prescricao.medicamento)
    campo('Medicamento', med)
    campo('Posologia', prescricao.posologia)
    campo('Duração', prescricao.duracao)
    if (prescricao.observacoes) campo('Observações', prescricao.observacoes)
  }
  y -= 8

  titulo('6. TIPO DE ATENDIMENTO')
  campo('Modalidade', paciente.tipoAtendimento)
  if (paciente.convenio) campo('Convênio', paciente.convenio)

  const emitido = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  page.drawText(`Emitido em: ${emitido}`, {
    x: m, y: 72, font, size: 8, color: rgb(0.5, 0.5, 0.5),
  })
  const carimboForm = carimboFromEnv('formulario', paciente.pacienteId ?? 0)
  await desenharCarimboDigital(doc, page, { x: m, y: 8, width: width - m * 2, height: 60 }, carimboForm)

  return Buffer.from(await doc.save())
}

/**
 * Lê o certificado .pfx do ICP-Brasil — prioridade:
 *   1. env.ICP_PFX_BASE64 (Railway/produção)
 *   2. server/certs/werciley.pfx (desenvolvimento)
 */
async function lerPfx(): Promise<Buffer | null> {
  if (env.ICP_PFX_BASE64) return Buffer.from(env.ICP_PFX_BASE64, 'base64')
  try { return await readFile(path.join(CERTS_DIR, 'werciley.pfx')) }
  catch { return null }
}

/** Lê o serial do certificado a partir do .pfx para registro de auditoria. */
function extrairSerial(pfxData: Buffer, password: string): string {
  const pfxDer = pfxData.toString('binary')
  const pfxAsn1 = forge.asn1.fromDer(pfxDer)
  const pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password)
  const certBag = pfxObj.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]
  return certBag?.cert?.serialNumber ?? 'unknown'
}

export interface CertificadoInfo {
  status: 'configurado' | 'demo' | 'erro'
  /** CN (Common Name) do titular */
  titular?: string
  /** CN do emissor */
  emissor?: string
  serial?: string
  validoDe?: Date
  validoAte?: Date
  diasRestantes?: number
  /** True se está dentro do período de validade */
  valido?: boolean
  /** True se vence em menos de 60 dias */
  vencendoEm60Dias?: boolean
  mensagem?: string
}

/**
 * Inspeciona o certificado .pfx ICP-Brasil configurado e retorna informações
 * de validade. Útil para painel de admin acompanhar vencimento do certificado.
 *
 * Não lança exceção em nenhum caso — sempre retorna um status.
 */
export async function inspecionarCertificado(): Promise<CertificadoInfo> {
  const pfxData = await lerPfx()
  if (!pfxData) {
    return {
      status: 'demo',
      mensagem: 'Certificado ICP-Brasil não configurado (modo DEMO em desenvolvimento)',
    }
  }

  try {
    const password = env.ICP_PFX_PASSWORD ?? ''
    const pfxDer = pfxData.toString('binary')
    const pfxAsn1 = forge.asn1.fromDer(pfxDer)
    const pfxObj = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password)
    const certBag = pfxObj.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0]
    const cert = certBag?.cert
    if (!cert) {
      return { status: 'erro', mensagem: 'Não foi possível extrair certificado do .pfx' }
    }

    const agora = new Date()
    const validoDe = cert.validity.notBefore
    const validoAte = cert.validity.notAfter
    const diasRestantes = Math.floor((validoAte.getTime() - agora.getTime()) / 86_400_000)
    const valido = agora >= validoDe && agora <= validoAte

    return {
      status: 'configurado',
      titular: cert.subject.getField('CN')?.value,
      emissor: cert.issuer.getField('CN')?.value,
      serial: cert.serialNumber,
      validoDe,
      validoAte,
      diasRestantes,
      valido,
      vencendoEm60Dias: valido && diasRestantes <= 60,
    }
  } catch (err) {
    return {
      status: 'erro',
      mensagem: `Erro ao ler certificado: ${(err as Error).message}`,
    }
  }
}

export async function assinarPdf(
  pdfBuffer: Buffer,
  titulo = 'Documento PrEP — Facilita PrEP',
): Promise<PdfSignResult> {
  const pfxPassword = env.ICP_PFX_PASSWORD ?? ''
  const pfxData = await lerPfx()

  // Sem certificado: modo DEMO (apenas em desenvolvimento)
  if (!pfxData) {
    if (env.NODE_ENV !== 'production') {
      const doc = await PDFDocument.load(pdfBuffer)
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      doc.getPages().forEach(p => {
        const { width } = p.getSize()
        p.drawRectangle({ x: 0, y: 0, width, height: 22, color: rgb(1, 0.92, 0.7) })
        p.drawText('DEMO LOCAL — documento NÃO assinado digitalmente (certificado ICP-Brasil ausente)', {
          x: 16, y: 7, size: 8, font, color: rgb(0.45, 0.3, 0),
        })
      })
      const buf = Buffer.from(await doc.save())
      return { buffer: buf, certificadoSerial: 'DEMO-LOCAL', assinadoEm: new Date() }
    }
    throw new Error('Certificado ICP-Brasil não configurado. Defina ICP_PFX_BASE64 no Railway ou coloque werciley.pfx em server/certs/')
  }

  // 1. Atualiza metadados antes da assinatura (para que sejam parte do que é assinado)
  const docComMetadados = await PDFDocument.load(pdfBuffer)
  docComMetadados.setTitle(titulo)
  docComMetadados.setProducer('Facilita PrEP — ICP-Brasil')
  docComMetadados.setCreator('Facilita PrEP')
  const assinadoEm = new Date()
  docComMetadados.setModificationDate(assinadoEm)
  const pdfComMetadados = Buffer.from(await docComMetadados.save({ useObjectStreams: false }))

  // 2. Adiciona placeholder de assinatura no PDF (PAdES SubFilter ETSI.CAdES.detached)
  const pdfComPlaceholder = plainAddPlaceholder({
    pdfBuffer: pdfComMetadados,
    reason: 'Documento médico assinado digitalmente — Facilita PrEP',
    contactInfo: env.MEDICO_NOME,
    name: env.MEDICO_NOME,
    location: `${env.MEDICO_CRM_TIPO}/${env.MEDICO_CRM_UF} ${env.MEDICO_CRM}`,
    signingTime: assinadoEm,
    subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    appName: 'Facilita PrEP',
  })

  // 3. Assina o placeholder com o .pfx (PKCS#7 detached SignedData)
  const signer = new P12Signer(pfxData, { passphrase: pfxPassword })
  const signedBuffer = await signpdf.sign(pdfComPlaceholder, signer)

  const certificadoSerial = extrairSerial(pfxData, pfxPassword)

  return {
    buffer: Buffer.from(signedBuffer),
    certificadoSerial,
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
