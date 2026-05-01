/**
 * Preenche o Formulário de Cadastramento de Usuário SUS PrEP (página 1).
 *
 * Estratégia: carrega o PDF editável oficial, aplica overlay de texto sobre
 * cada Widget annotation já mapeado por nome e coordenada. Isso preserva o
 * layout original sem precisar de uma entrada /AcroForm no catálogo.
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'Formulário de Cadastro SUS.pdf')

// Coordenadas extraídas do PDF (rect = [x1, y1, x2, y2] em pontos PDF).
// O texto é desenhado em (x1 + 2, y1 + 3) — 2 pt de margem horizontal, 3 pt vertical.
const CAMPOS: Record<string, [number, number, number, number]> = {
  '1-CPF':                   [23.1,  762.6, 129.9, 780.4],
  '2-CNS':                   [156.7, 761.7, 292.9, 774.7],
  '6-Nome Civil':            [24.3,  728.9, 564.6, 748.1],
  '7-nomeSocial':            [22.3,  696.9, 562.9, 716.0],
  '8-nomeMae':               [21.8,  664.8, 559.9, 681.4],
  '9-dt_nasc':               [25.8,  636.0,  95.4, 652.5],
  '10-Raça':                 [168.6, 639.6, 286.3, 659.1],
  '11-sexo':                 [460.1, 639.4, 569.3, 655.3],
  '12-gênero':               [116.5, 615.2, 267.4, 631.6],
  '13-Orientação':           [427.9, 616.4, 572.3, 632.8],
  '14-UF_nasc':              [33.1,  586.6,  59.6, 602.3],
  '15-CD_nasc':              [89.2,  586.1, 287.1, 601.9],
  '21-UF_resid':             [33.4,  533.3,  61.8, 549.1],
  '22-CD_resid':             [143.0, 532.5, 338.9, 547.7],
  '23-Escolaridade':         [95.6,  507.4, 291.6, 526.6],
  '24-situação_rua':         [314.7, 501.3, 393.9, 515.7],
  '25-privada de liberdade': [413.6, 501.5, 491.9, 514.2],
  'Permite contato':         [26.5,  469.1,  96.5, 485.7],
  'TP_contato':              [170.3, 473.2, 337.1, 489.8],
  'Endereço':                [25.4,  409.6, 574.0, 429.3],
  'Bairro':                  [43.5,  386.4, 422.4, 406.1],
  'CÈP':                     [463.1, 383.3, 577.5, 403.0],
  'e-mail':                  [29.9,  357.1, 567.4, 372.5],
  'tp_telefone1':            [90.9,  332.1, 167.6, 347.4],
  'telefone1':               [207.3, 327.2, 333.8, 341.3],
  'Autorizado1':             [28.3,  222.1, 569.7, 238.8],
  'cpf_RG01':                [474.9, 240.4, 576.9, 257.3],
  'Autorizado2':             [29.2,  183.2, 570.6, 200.0],
  'cpf_RG02':                [473.2, 203.3, 575.2, 220.1],
  'Autorizado3':             [30.7,  147.8, 572.1, 162.6],
  'cpf_RG03':                [473.2, 164.4, 575.2, 181.3],
}

export interface DadosCadastroSUS {
  cpf: string
  cns?: string | null
  nome: string
  nomeSocial?: string | null
  nomeMae?: string | null
  dataNascimento?: string | null     // YYYY-MM-DD
  corRaca?: string | null
  sexo?: string | null
  identidadeGenero?: string | null
  orientacaoSexual?: string | null
  ufNascimento?: string | null
  municipioNascimento?: string | null
  estado?: string | null
  cidade?: string | null
  escolaridade?: string | null
  situacaoRua?: boolean | null
  privadoLiberdade?: boolean | null
  permiteContato?: boolean | null
  tipoContato?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cep?: string | null
  email?: string | null
  tipoTelefone?: string | null
  telefone?: string | null
  autorizados?: Array<{
    nome: string
    parentesco: string
    cpfRg?: string | null
  }> | null
}

function formatarData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function labelCorRaca(v: string): string {
  const map: Record<string, string> = {
    branca: 'Branca', preta: 'Preta', parda: 'Parda',
    amarela: 'Amarela', indigena: 'Indígena', nao_informado: 'Não informado',
  }
  return map[v] ?? v
}

function labelSexo(v: string): string {
  const map: Record<string, string> = {
    masculino: 'Masculino', feminino: 'Feminino', outro: 'Outro',
  }
  return map[v] ?? v
}

function labelGenero(v: string): string {
  const map: Record<string, string> = {
    'cisgênero_fem':    'Mulher cisgênero',
    'cisgênero_masc':   'Homem cisgênero',
    'transgênero_fem':  'Mulher transgênero / Travesti',
    'transgênero_masc': 'Homem transgênero',
    nao_binario:        'Não-binário',
    nao_informado:      'Não informado',
  }
  return map[v] ?? v
}

function labelOrientacao(v: string): string {
  const map: Record<string, string> = {
    heterossexual: 'Heterossexual',
    homossexual:   'Gay / Lésbica',
    bissexual:     'Bissexual',
    nao_informado: 'Não informado',
  }
  return map[v] ?? v
}

function labelEscolaridade(v: string): string {
  const map: Record<string, string> = {
    sem_escolaridade:       'Sem escolaridade',
    fundamental_incompleto: 'Fundamental incompleto',
    fundamental_completo:   'Fundamental completo',
    medio_incompleto:       'Médio incompleto',
    medio_completo:         'Médio completo',
    superior_incompleto:    'Superior incompleto',
    superior_completo:      'Superior completo',
    pos_graduacao:          'Pós-graduação',
  }
  return map[v] ?? v
}

function labelTipoTelefone(v: string): string {
  const map: Record<string, string> = {
    celular_whatsapp: 'Celular', fixo: 'Fixo', comercial: 'Comercial',
  }
  return map[v] ?? v
}

function labelTipoContato(v: string): string {
  const map: Record<string, string> = {
    celular: 'Celular', residencial: 'Residencial', email: 'E-mail', outros: 'Outros',
  }
  return map[v] ?? v
}

export async function preencherCadastroSUS(dados: DadosCadastroSUS): Promise<Uint8Array> {
  const templateBytes = readFileSync(TEMPLATE_PATH)
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const page = pdfDoc.getPages()[0]
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontSize = 8
  const color = rgb(0, 0, 0)

  function drawText(fieldName: string, text: string | null | undefined) {
    if (!text) return
    const rect = CAMPOS[fieldName]
    if (!rect) return
    const [x1, y1, , y2] = rect
    // Vertical center within the field rect
    const fieldHeight = y2 - y1
    const textY = y1 + (fieldHeight - fontSize) / 2
    page.drawText(text, { x: x1 + 2, y: textY, font, size: fontSize, color })
  }

  function drawCheckmark(fieldName: string, checked: boolean | null | undefined) {
    if (!checked) return
    const rect = CAMPOS[fieldName]
    if (!rect) return
    const [x1, y1, x2, y2] = rect
    const cx = (x1 + x2) / 2
    const cy = (y1 + y2) / 2
    page.drawText('X', { x: cx - 3, y: cy - 4, font, size: 9, color })
  }

  // ── Identificação ─────────────────────────────────────────────
  drawText('1-CPF', dados.cpf)
  drawText('2-CNS', dados.cns)
  drawText('6-Nome Civil', dados.nome)
  drawText('7-nomeSocial', dados.nomeSocial)
  drawText('8-nomeMae', dados.nomeMae)
  if (dados.dataNascimento) drawText('9-dt_nasc', formatarData(dados.dataNascimento))
  if (dados.corRaca) drawText('10-Raça', labelCorRaca(dados.corRaca))
  if (dados.sexo) drawText('11-sexo', labelSexo(dados.sexo))
  if (dados.identidadeGenero) drawText('12-gênero', labelGenero(dados.identidadeGenero))
  if (dados.orientacaoSexual) drawText('13-Orientação', labelOrientacao(dados.orientacaoSexual))

  // ── Naturalidade / residência ─────────────────────────────────
  drawText('14-UF_nasc', dados.ufNascimento)
  drawText('15-CD_nasc', dados.municipioNascimento)
  drawText('21-UF_resid', dados.estado)
  drawText('22-CD_resid', dados.cidade)
  if (dados.escolaridade) drawText('23-Escolaridade', labelEscolaridade(dados.escolaridade))

  // ── Situação social ───────────────────────────────────────────
  drawCheckmark('24-situação_rua', dados.situacaoRua)
  drawCheckmark('25-privada de liberdade', dados.privadoLiberdade)

  // ── Contato ───────────────────────────────────────────────────
  drawCheckmark('Permite contato', dados.permiteContato)
  if (dados.tipoContato) drawText('TP_contato', labelTipoContato(dados.tipoContato))

  const enderecoCompleto = [dados.logradouro, dados.numero, dados.complemento].filter(Boolean).join(', ')
  drawText('Endereço', enderecoCompleto || null)
  drawText('Bairro', dados.bairro)
  drawText('CÈP', dados.cep)
  drawText('e-mail', dados.email)
  if (dados.tipoTelefone) drawText('tp_telefone1', labelTipoTelefone(dados.tipoTelefone))
  drawText('telefone1', dados.telefone)

  // ── Pessoas autorizadas ───────────────────────────────────────
  const aut = dados.autorizados ?? []
  if (aut[0]) {
    drawText('Autorizado1', `${aut[0].nome} (${aut[0].parentesco})`)
    drawText('cpf_RG01', aut[0].cpfRg)
  }
  if (aut[1]) {
    drawText('Autorizado2', `${aut[1].nome} (${aut[1].parentesco})`)
    drawText('cpf_RG02', aut[1].cpfRg)
  }
  if (aut[2]) {
    drawText('Autorizado3', `${aut[2].nome} (${aut[2].parentesco})`)
    drawText('cpf_RG03', aut[2].cpfRg)
  }

  return pdfDoc.save()
}
