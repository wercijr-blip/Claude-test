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

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'ficha_atendimento.pdf')

export interface DadosFichaAtendimento {
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
}

export interface ConfigClinica {
  cnes: string
  crmTipo: string                                  // 'CRM'
  crmUf: string                                    // 'DF'
  crmNumero: string                                // '16381'
}

function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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

  // ── 16. Sintomas IST: nenhum marcado, exceto "Não" (CB11) ────
  for (let i = 1; i <= 12; i++) {
    checkBox(`Caixa de verificação ${i}`, i === 11)
  }

  // ── 17/18/19. Conduta de risco ────────────────────────────────
  setDropdown('17-SEXOPORDINHEIRO', 'Não')
  setDropdown('18-droga_inj', 'Não')
  setDropdown('19-PSICOATIVAS', 'Não')

  // ── 20. Como tomou PrEP — só preenche se já faz PrEP ─────────
  if (dados.tipoConsulta === 'ja_faco_prep' && dados.prepAdesao) {
    setDropdown('16-comotomouPrEP', dados.prepAdesao)
  }

  // ── 21. Modalidade PrEP ───────────────────────────────────────
  setDropdown('21-modalidade', dados.prepModalidade ?? 'PrEP diária')

  // ── 23. Prescrição ────────────────────────────────────────────
  // 22-autoteste: em branco
  // 23-quantidadeComprimidos: em branco (definida na dispensação)
  setText('23-dt_prescrição', dataAtualBR())

  // ── 24. Prescritor ────────────────────────────────────────────
  setText('23a-tipoConselho', config.crmTipo)
  setDropdown('23b-UF_cons', config.crmUf)
  setText('23cNconselho', config.crmNumero)
  // Signature2: assinatura digital ICP-Brasil aplicada na pipeline pdfSigner

  // Descartar página 2 (instruções — não precisa imprimir)
  while (pdfDoc.getPageCount() > 1) {
    pdfDoc.removePage(pdfDoc.getPageCount() - 1)
  }

  return pdfDoc.save()
}
