/**
 * Preenche o Formulário 02 — Ficha de Atendimento PrEP (FEV/2025).
 *
 * Defaults conforme política da clínica:
 *   - Serviço: Serviço Especializado | Origem: Privada | CNES: SUS_CNES (env)
 *   - Identificação Preferencial: Nome Civil
 *   - Uso de PrEP relacionado: não se aplica
 *   - 13. Estudo de vacina: Não
 *   - 14. Exame HIV: Sorologia (data vinda da validação do exame)
 *   - 16. Sintomas IST: marca apenas a opção "Não"
 *   - 17/18/19. Conduta de risco: Não
 *   - 21. Modalidade: PrEP diária (paciente pode ter escolhido outra)
 *   - 24. Prescritor: CRM/DF (env MEDICO_CRM/UF/N)
 *   - Data prescrição: data atual
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync } from 'fs'
import { PDFDocument } from 'pdf-lib'
import { desenharCarimboDigital, carimboFromEnv, type CarimboInfo } from './carimboDigital.ts'
import { env } from '../_core/env.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'ficha_atendimento.pdf')

export interface DadosFichaAtendimento {
  pacienteId: number
  cpf: string
  nome: string
  nomeMae: string
  dataNascimento: string                          // YYYY-MM-DD
  /** YYYY-MM-DD — data do exame HIV não reagente validado */
  dataExameHiv?: string | null
  /** 'PrEP diária' | 'PrEP sob demanda' — escolhido pelo paciente */
  prepModalidade?: 'PrEP diária' | 'PrEP sob demanda' | null
  /** 'primeiro_atendimento' | 'ja_faco_prep' */
  tipoConsulta?: 'primeiro_atendimento' | 'ja_faco_prep' | null
  /** Como tomou PrEP desde a última dispensa (apenas se ja_faco_prep) */
  prepAdesao?: 'Esquema diário' | 'Esquema sob demanda' | 'Ambos' | 'Eu não tomei' | null
  /** Item 16 — paciente declarou ter sintomas IST? Se null/undefined, marca "Não". */
  temSintomasDst?: boolean | null
  /** Itens 18 e 19 — paciente declarou uso de drogas? Se null/undefined, marca "Não". */
  usoDrogas?: boolean | null
}

export interface ConfigClinica {
  cnes: string
  crmTipo: string                                  // 'CRM'
  crmUf: string                                    // 'DF'
  crmNumero: string                                // '16381'
}

export function buildConfigClinica(): ConfigClinica {
  return {
    cnes: env.SUS_CNES,
    crmTipo: env.MEDICO_CRM_TIPO,
    crmUf: env.MEDICO_CRM_UF,
    crmNumero: env.MEDICO_CRM,
  }
}

export function mapPrepAdesaoLabel(
  prepAdesao?: 'diaria' | 'sob_demanda',
): 'Esquema diário' | 'Esquema sob demanda' | undefined {
  if (prepAdesao === 'diaria') return 'Esquema diário'
  if (prepAdesao === 'sob_demanda') return 'Esquema sob demanda'
  return undefined
}

/**
 * Aceita data em ISO (YYYY-MM-DD) ou BR (DD/MM/AAAA) e devolve DD/MM/AAAA.
 *
 * Histórico do bug: a IA de validação do exame extrai a data em formato
 * brasileiro DD/MM/AAAA (server/examValidation.ts:15) e grava direto em
 * consultas_inicio.data_exame_validado. A versão original desta função
 * só tratava ISO — fazia split('-') no input "24/04/2026", produzia
 * "undefined/undefined/24/04/2026", o setText do pdf-lib rejeitava e o
 * try/catch silencioso deixava o campo 14a-dt_resultado em branco no PDF.
 */
function formatarDataBR(input: string): string {
  if (!input) return ''
  // Já está em DD/MM/AAAA? retorna apenas a primeira ocorrência válida
  const matchBR = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchBR) {
    const [, dd, mm, yyyy] = matchBR
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`
  }
  // ISO format YYYY-MM-DD
  const parts = input.split('-')
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts
    return `${dd!.padStart(2, '0')}/${mm!.padStart(2, '0')}/${yyyy}`
  }
  return input
}

function dataAtualBR(): string {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

export async function preencherFichaAtendimento(
  dados: DadosFichaAtendimento,
  config: ConfigClinica,
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
  const checkBox = (name: string, checked: boolean) => {
    try {
      const cb = form.getCheckBox(name)
      if (checked) cb.check()
      else cb.uncheck()
    } catch {}
  }

  // ── Cabeçalho do serviço ──────────────────────────────────────
  setDropdown('1-serviço', 'Serviço Especializado')
  setDropdown('2-acompanhamento_médico', 'Privada')
  setText('3-CNES', config.cnes)
  setDropdown('4-ident_preferencial', 'Nome Civil')

  // ── Identificação ─────────────────────────────────────────────
  setText('5-CPF', dados.cpf)
  // 6-CNS: em branco
  // 8-prontuário: em branco
  setText('9-nm_pac', dados.nome)
  // 10-nm_social: em branco
  setText('11-nm_mae', dados.nomeMae)
  setText('12-dt_nasc', formatarDataBR(dados.dataNascimento))

  // ── Exame HIV ─────────────────────────────────────────────────
  setDropdown('13-estudo', 'Não')
  // Carga viral 13a: em branco (paciente não é HIV+)
  setDropdown('14-tp_exame', 'Sorologia')
  if (dados.dataExameHiv) {
    setText('14a-dt_resultado', formatarDataBR(dados.dataExameHiv))
  }

  // ── Indicação PrEP ────────────────────────────────────────────
  setDropdown('11-USOPreprelacionado', 'não se aplica')

  // ── 16. Sintomas IST ──────────────────────────────────────────
  // Layout: 12 checkboxes — 11 sintomas específicos (CB1-CB11) + CB12 ("Não").
  // Quando o paciente declara que NÃO tem sintomas, marcamos o CB12.
  // Quando declara que TEM, deixamos os 12 desmarcados — o paciente não
  // detalha quais sintomas, então o médico avalia presencialmente.
  for (let i = 1; i <= 12; i++) {
    const marcarNao = dados.temSintomasDst !== true
    checkBox(`Caixa de verificação ${i}`, marcarNao && i === 12)
  }

  // ── 17/18/19. Conduta de risco ────────────────────────────────
  // Item 17 (sexo por dinheiro): mantido oculto e fixo em "Não" por
  //   decisão do cliente — pergunta sensível não é exposta ao paciente.
  // Itens 18 e 19 (drogas): vêm do `usoDrogas` do Step 4. Como o
  //   paciente responde uma pergunta única ("faz uso de drogas?"), o
  //   "Sim" propaga para os dois itens (injetáveis e psicoativas) —
  //   o médico desmembra na consulta se houver detalhamento.
  setDropdown('17-SEXOPORDINHEIRO', 'Não')
  const drogas = dados.usoDrogas === true ? 'Sim' : 'Não'
  setDropdown('18-droga_inj', drogas)
  setDropdown('19-PSICOATIVAS', drogas)

  // ── 20. Como tomou PrEP — só preenche se já faz PrEP ─────────
  if (dados.tipoConsulta === 'ja_faco_prep' && dados.prepAdesao) {
    setDropdown('16-comotomouPrEP', dados.prepAdesao)
  }

  // ── 21. Modalidade PrEP ───────────────────────────────────────
  setDropdown('21-modalidade', dados.prepModalidade ?? 'PrEP diária')

  // ── 23. Prescrição ────────────────────────────────────────────
  // 22-autoteste: em branco
  setDropdown('23-quantidadeComprimidos', '180*** comprimidos')
  setText('23-dt_prescrição', dataAtualBR())

  // ── 24. Prescritor ────────────────────────────────────────────
  setText('23a-tipoConselho', config.crmTipo)
  setDropdown('23b-UF_cons', config.crmUf)
  setText('23cNconselho', config.crmNumero)
  // ── Remove botões interativos do PDF (Imprimir / Salvar / Limpar formulário) ──
  for (const btn of ['Imprimir', 'Salvar Como', 'limpar formulário']) {
    try { form.removeField(form.getButton(btn)) } catch {}
  }

  // ── Carimbo digital + QR Code ─────────────────────────────────
  // Signature2 rect oficial: (291, 280) w=279 h=29 — porém com altura
  // 29pt o QR fica em ~25pt (≈9mm), abaixo do mínimo confiável (~15mm)
  // para leitura por scanner/celular. Estendemos para baixo (y=250,
  // h=60), mantendo a borda direita e topo originais. QR resultante
  // fica ~56pt (≈2cm), legível em condições normais.
  const info = carimbo ?? carimboFromEnv('ficha', dados.pacienteId)
  const page = pdfDoc.getPages()[0]
  await desenharCarimboDigital(pdfDoc, page, { x: 291, y: 250, width: 279, height: 60 }, info)

  // Descartar página 2 (instruções — não precisa imprimir)
  while (pdfDoc.getPageCount() > 1) {
    pdfDoc.removePage(pdfDoc.getPageCount() - 1)
  }

  return pdfDoc.save()
}
