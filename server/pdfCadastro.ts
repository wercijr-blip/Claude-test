import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface DadosCadastro {
  nome: string
  cpf: string
  dataNascimento: string | null
  sexo: string | null
  nomeSocial: string | null
  corRaca: string | null
  escolaridade: string | null
  situacaoConjugal: string | null
  email: string | null
  telefone: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  tipoAtendimento: string | null
  convenio: string | null
}

export async function gerarCadastroPdf(dados: DadosCadastro): Promise<Buffer> {
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

  const campo = (label: string, valor: string | null | undefined, inline = false) => {
    page.drawText(label + ':', { x: m, y, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) })
    page.drawText(valor ?? '—', { x: inline ? m + 130 : m + 160, y, font, size: 9, color: rgb(0.1, 0.1, 0.1) })
    y -= 16
  }

  const campoLinha = (label: string, valor: string | null | undefined) => {
    page.drawText(label + ':', { x: m, y, font: fontBold, size: 9, color: rgb(0.4, 0.4, 0.4) })
    y -= 13
    page.drawText(valor ?? '—', { x: m + 10, y, font, size: 9, color: rgb(0.1, 0.1, 0.1) })
    page.drawLine({ start: { x: m, y: y - 2 }, end: { x: width - m, y: y - 2 }, thickness: 0.3, color: rgb(0.9, 0.9, 0.9) })
    y -= 16
  }

  // Header
  page.drawText('FACILITA PrEP', { x: m, y, font: fontBold, size: 18, color: rgb(0.07, 0.27, 0.52) })
  y -= 20
  page.drawText('Ficha de Cadastro do Paciente PrEP', { x: m, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) })
  y -= 12
  page.drawLine({ start: { x: m, y }, end: { x: width - m, y }, thickness: 1.5, color: rgb(0.07, 0.27, 0.52) })
  y -= 24

  // Dados pessoais
  titulo('1. IDENTIFICAÇÃO')
  campo('Nome completo', dados.nome)
  campo('CPF', dados.cpf)
  campo('Data de nascimento', dados.dataNascimento ? dados.dataNascimento.split('-').reverse().join('/') : null)
  campo('Sexo biológico', dados.sexo)
  if (dados.nomeSocial) campo('Nome social', dados.nomeSocial)
  y -= 8

  // Dados demográficos
  titulo('2. DADOS DEMOGRÁFICOS')
  campo('Cor/Raça', dados.corRaca)
  campo('Escolaridade', dados.escolaridade)
  campo('Situação conjugal', dados.situacaoConjugal)
  y -= 8

  // Contato
  titulo('3. CONTATO')
  campo('E-mail', dados.email)
  campo('Telefone / WhatsApp', dados.telefone)
  const endereco = [dados.logradouro, dados.numero, dados.complemento, dados.bairro, dados.cidade, dados.estado].filter(Boolean).join(', ')
  campoLinha('Endereço', endereco || null)
  campo('CEP', dados.cep)
  y -= 8

  // Tipo de atendimento
  titulo('4. TIPO DE ATENDIMENTO')
  campo('Modalidade', dados.tipoAtendimento)
  if (dados.convenio) campo('Convênio', dados.convenio)
  y -= 8

  // Declaração
  y -= 10
  page.drawText('Declaro que as informações acima são verdadeiras e autorizo o tratamento dos meus dados', {
    x: m, y, font, size: 8, color: rgb(0.5, 0.5, 0.5),
  })
  y -= 12
  page.drawText('pessoais pela Facilita PrEP conforme a LGPD (Lei 13.709/2018).', {
    x: m, y, font, size: 8, color: rgb(0.5, 0.5, 0.5),
  })
  y -= 30

  // Assinatura
  page.drawLine({ start: { x: m, y }, end: { x: m + 200, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
  y -= 12
  page.drawText('Assinatura do paciente', { x: m, y, font, size: 8, color: rgb(0.6, 0.6, 0.6) })
  page.drawText(`Data: ___/___/______`, { x: width - m - 120, y: y + 12, font, size: 8, color: rgb(0.6, 0.6, 0.6) })

  // Rodapé
  const emitido = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  page.drawText(`Facilita PrEP · claude-test-production-8672.up.railway.app · Emitido em ${emitido}`, {
    x: m, y: 28, font, size: 7, color: rgb(0.7, 0.7, 0.7),
  })

  return Buffer.from(await doc.save())
}
