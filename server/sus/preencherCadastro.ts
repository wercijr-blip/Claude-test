/**
 * Preenche o Formulário 01 — Cadastramento de Usuário SUS PrEP.
 *
 * Usa a API AcroForm do pdf-lib (o PDF oficial tem campos de formulário
 * proper). Aplica defaults conforme política da clínica:
 *   - Identificação Preferencial: Nome Civil
 *   - País Nasc/Resid: Brasil  | Nacionalidade: Brasileira
 *   - Habitante de fronteira / Situação de rua / Pessoa privada de liberdade: Não
 *   - Permite contato: Não  | Tipo de contato: Telefone
 *   - Tipo de telefone (1): Celular
 *   - Origem do acompanhamento: Privado
 *   - CNS, Prontuário, Telefone 2/Tipo Tel 2/Obs, Autorizados: em branco
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { PDFDocument } from 'pdf-lib'
import { desenharCarimboDigital, carimboFromEnv, type CarimboInfo } from './carimboDigital.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'cadastro_paciente.pdf')

export interface DadosCadastroSUS {
  pacienteId: number
  cpf: string
  nome: string
  nomeMae: string
  dataNascimento: string                          // YYYY-MM-DD
  corRaca?: string | null                          // 'branca' | 'preta' | 'parda' | 'amarela' | 'indigena'
  sexo?: string | null                             // 'masculino' | 'feminino' | 'outro'
  identidadeGenero?: string | null                 // 'cisgênero_fem' | 'cisgênero_masc' | 'transgênero_fem' | 'transgênero_masc' | 'nao_binario'
  orientacaoSexual?: string | null                 // 'heterossexual' | 'homossexual' | 'bissexual'
  ufNascimento?: string | null
  municipioNascimento?: string | null
  estado?: string | null                           // UF de residência
  cidade?: string | null                           // Município de residência
  escolaridade?: string | null                     // chave do shared/const ESCOLARIDADE_OPTIONS
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cep?: string | null
  email?: string | null
  telefone?: string | null
}

const corRacaMap: Record<string, string> = {
  branca: 'Branca', preta: 'Preta', parda: 'Parda',
  amarela: 'Amarela', indigena: 'Indígena',
}

const sexoMap: Record<string, string> = {
  masculino: 'Masculino', feminino: 'Feminino', outro: 'Intersexo',
}

const generoMap: Record<string, string> = {
  'cisgênero_fem':    'Mulher CIS',
  'cisgênero_masc':   'Homem CIS',
  'transgênero_fem':  'Mulher trans',
  'transgênero_masc': 'Homem trans',
  nao_binario:        'Não binário',
}

const orientacaoMap: Record<string, string> = {
  heterossexual: 'Heterossexual',
  bissexual:     'Bissexual',
  homossexual:   'Homossexual/Gay/Lésbica',
}

// Escolaridade do shared/const → opções oficiais do PDF (faixa de anos)
const escolaridadeMap: Record<string, string> = {
  sem_escolaridade:       'Nenhuma/Sem educação Formal',
  fundamental_incompleto: 'De 1 a 3 anos',
  fundamental_completo:   'De 4 a 7 anos',
  medio_incompleto:       'De 8 a 11 anos',
  medio_completo:         'De 8 a 11 anos',
  superior_incompleto:    'De 12 a mais anos',
  superior_completo:      'De 12 a mais anos',
  pos_graduacao:          'De 12 a mais anos',
}

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function preencherCadastroSUS(
  dados: DadosCadastroSUS,
  carimbo?: CarimboInfo,
): Promise<Uint8Array> {
  const templateBytes = readFileSync(TEMPLATE_PATH)
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true })
  const form = pdfDoc.getForm()

  const setText = (name: string, value?: string | null) => {
    if (value == null || value === '') return
    try { form.getTextField(name).setText(value) } catch {}
  }
  const setDropdown = (name: string, value?: string | null) => {
    if (value == null || value === '') return
    try { form.getDropdown(name).select(value) } catch {}
  }

  // ── 1. Identificação ───────────────────────────────────────────
  setText('1-CPF', dados.cpf)
  // 2-CNS: em branco (instrução do cliente)
  // 3-Pront: em branco
  setDropdown('4-ident_preferencial', 'Nome Civil')
  setText('5-Nome Civil', dados.nome)
  // 6-nomeSocial: em branco (não perguntamos)
  setText('7-nomeMae', dados.nomeMae)
  setText('8-dt_nasc', formatarDataBR(dados.dataNascimento))

  // ── 2. Demográfico ─────────────────────────────────────────────
  if (dados.corRaca && corRacaMap[dados.corRaca]) {
    setDropdown('9-Raça', corRacaMap[dados.corRaca])
  }
  if (dados.sexo && sexoMap[dados.sexo]) {
    setDropdown('10-sexo', sexoMap[dados.sexo])
  }
  if (dados.identidadeGenero && generoMap[dados.identidadeGenero]) {
    setDropdown('11-gênero', generoMap[dados.identidadeGenero])
  }
  if (dados.orientacaoSexual && orientacaoMap[dados.orientacaoSexual]) {
    setDropdown('12-Orientação', orientacaoMap[dados.orientacaoSexual])
  }
  setDropdown('13-UF_nasc', dados.ufNascimento)
  setText('14-CD_nasc', dados.municipioNascimento)
  setText('15-País', 'Brasil')
  setText('16-Nacionalidade', 'Brasileira')
  // 17-situação_migrante: deixa em branco (paciente brasileiro padrão)
  setText('18-país_resid', 'Brasil')
  setDropdown('19-habitante_fronteira', 'Não')
  setDropdown('20-UF', dados.estado)
  setText('21-CD_resid', dados.cidade)
  if (dados.escolaridade && escolaridadeMap[dados.escolaridade]) {
    setDropdown('22-Escolaridade', escolaridadeMap[dados.escolaridade])
  }
  setDropdown('23-situação_rua', 'Não')
  setDropdown('24-privada de liberdade', 'Não')

  // ── 3. Contato ─────────────────────────────────────────────────
  setDropdown('Permite contato', 'Não')
  setDropdown('TP_contato', 'Telefone')
  const enderecoCompleto = [dados.logradouro, dados.numero, dados.complemento]
    .filter(Boolean).join(', ')
  setText('Endereço', enderecoCompleto || null)
  setText('Bairro', dados.bairro)
  setText('CÈP', dados.cep)
  setText('e-mail', dados.email)
  setDropdown('tp_telefone1', 'Celular')
  setText('telefone1', dados.telefone)
  // tp_telefone2 / telefone2 / Obs1 / Obs2 / Outros: em branco

  // ── 4. Origem ──────────────────────────────────────────────────
  setDropdown('28-Origem_acomp', 'Privado')

  // ── 5. Autorizados: em branco (instrução do cliente) ──────────

  // ── Remove botões interativos do PDF (Imprimir / Limpar / Salvar) ──
  for (const btn of ['Button1', 'Button2', 'Button3']) {
    try { form.removeField(form.getButton(btn)) } catch {}
  }

  // ── 6. Carimbo digital + QR Code (área confirmada no rodapé) ──
  const info = carimbo ?? carimboFromEnv(dados.pacienteId, 'cadastro')
  const page = pdfDoc.getPages()[0]
  await desenharCarimboDigital(pdfDoc, page, { x: 20, y: 15, width: 290, height: 85 }, info)

  // Descartar página 2 (instruções de preenchimento — não precisa imprimir)
  while (pdfDoc.getPageCount() > 1) {
    pdfDoc.removePage(pdfDoc.getPageCount() - 1)
  }

  return pdfDoc.save()
}
