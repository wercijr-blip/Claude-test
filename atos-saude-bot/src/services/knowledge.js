import { readFileSync, existsSync } from 'fs'
import { extname } from 'path'
import { getKnowledge, insertKnowledge } from './db.js'
import { logger } from '../utils/logger.js'

async function extractText(filePath) {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.txt') {
    return readFileSync(filePath, 'utf-8')
  }

  if (ext === '.pdf') {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js')
    const buffer = readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text
  }

  if (ext === '.docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  }

  throw new Error(`Formato não suportado: ${ext}`)
}

function detectCategory(filename) {
  const lower = filename.toLowerCase()
  if (/convenio|plano/.test(lower)) return 'CONVENIO'
  if (/procedimento|cirurgia|exame/.test(lower)) return 'PROCEDIMENTO'
  if (/documento|guia|laudo/.test(lower)) return 'DOCUMENTOS'
  return 'GERAL'
}

function cleanText(text) {
  return text
    .replace(/\s{3,}/g, '\n')
    .replace(/\n{4,}/g, '\n\n')
    .replace(/^\d+\s*$/gm, '')
    .trim()
}

export async function ingestDocument(filePath) {
  if (!existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${filePath}`)
  const filename = filePath.split('/').pop()
  const category = detectCategory(filename)
  const rawText = await extractText(filePath)
  const content = cleanText(rawText)
  const id = insertKnowledge({ filename, content, category })
  return { id, filename, category, charCount: content.length }
}

export function searchKnowledge(question) {
  const docs = getKnowledge()
  if (!docs.length) return ''

  const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 3)

  const scored = docs.map(doc => {
    const lower = doc.content.toLowerCase()
    const score = words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0)
    return { ...doc, score }
  })

  scored.sort((a, b) => b.score - a.score)

  let result = ''
  let totalChars = 0
  for (const doc of scored.slice(0, 5)) {
    const section = `=== ${doc.filename} (${doc.category}) ===\n${doc.content}\n\n`
    if (totalChars + section.length > 8000) break
    result += section
    totalChars += section.length
  }
  return result
}

export async function seedKnowledgeBase() {
  const existing = getKnowledge()
  if (existing.length > 0) {
    logger.info('Knowledge base já populada, pulando seed.')
    return
  }

  const seeds = [
    {
      filename: 'convenios_aceitos.txt',
      category: 'CONVENIO',
      content: `Convênios aceitos pela Atos Saúde Integrada:
AFEB BRASAL, AFFEGO, ASTE (ASETE), ASSEDF / VIDA CARD, BACEN, BOMBEIROS DF,
BRB SAÚDE, CAEME-GO, CAESAN, CAIXA SAÚDE, CAMED, CARE PLUS, CASEC (CODEVASF),
CNTI, CONAB, E-VIDA (ELETRONORTE), EMB. DA AUSTRÁLIA, EMB. COTE D'IVOIRI,
EMB. DA DINAMARCA, EMB. DA KÊNIA, EMBRATEL - DEMAIS PLANOS, FACEB, FAPES (BNDES),
FASCAL, FUSEX, GAMA SAÚDE, GRAVIA, INFRAERO, LIFE EMPRESARIAL, MEDSENIOR,
NOTRE DAME, OMINT SAÚDE, PETROBRÁS DISTRIBUIDORA, PETROBRÁS PETRÓLEO,
PLAN ASSISTE (MPF), PLAN ASSISTE (MPM), PLAN ASSISTE (MPT), PLAS/JMU (STM),
PMDF, POSTAL SAÚDE (ECT), PROASA, PRÓ-SAÚDE (TJDFT), PRÓ-SOCIAL (TRF),
REAL GRANDEZA, SERPRO, STF-MED (STF), SULAMÉRICA, TRE SAÚDE, TRT SAÚDE,
TST SAÚDE, UNAFISCO (SINDIFISCO).

ATENÇÃO: Unimed, Bradesco Saúde e Amil NÃO são aceitos na Atos Saúde.`
    },
    {
      filename: 'documentos_autorizacao.txt',
      category: 'DOCUMENTOS',
      content: `Documentos necessários para autorização de procedimentos:
- Pedido médico com CID (Código Internacional de Doenças)
- Carteirinha do plano de saúde (original ou digital)
- CPF do beneficiário
- Laudo médico detalhado (para procedimentos de alta complexidade)

Para infusões e medicamentos especiais:
- Pedido médico com nome genérico do medicamento e dosagem
- Posologia (frequência e duração do tratamento)
- Justificativa clínica com CID
- Guia de autorização prévia (quando exigida pelo plano)`
    },
    {
      filename: 'prazos_ans.txt',
      category: 'GERAL',
      content: `Prazos máximos de atendimento conforme ANS (Agência Nacional de Saúde Suplementar):
- Consultas eletivas (rotina): 7 dias úteis
- Consultas em urgência: até 24 horas
- Consultas em emergência: imediato (sem carência)
- Exames de diagnóstico eletivos: 3 dias úteis
- Exames de diagnóstico com urgência: até 24 horas
- Cirurgias eletivas: 21 dias
- Cirurgias de urgência: até 24 horas
- Internação: prazo igual ao da consulta que motivou

O descumprimento dos prazos dá direito ao beneficiário de buscar serviço fora da rede com reembolso integral.`
    },
    {
      filename: 'sem_autorizacao.txt',
      category: 'PROCEDIMENTO',
      content: `Procedimentos que geralmente NÃO precisam de autorização prévia:
- Consultas de rotina (primeira consulta ou retorno)
- Hemograma completo
- Glicemia de jejum
- ECG simples (eletrocardiograma em repouso)
- Aferição de pressão arterial
- Curativos simples
- Vacinação (conforme cobertura do plano)

Procedimentos que GERALMENTE PRECISAM de autorização prévia:
- Cirurgias eletivas
- Internações programadas
- Infusões e medicamentos de alto custo
- Exames de imagem (tomografia, ressonância, cintilografia)
- Fisioterapia (a partir de determinado número de sessões)
- Procedimentos odontológicos cirúrgicos`
    },
    {
      filename: 'valores_particular.txt',
      category: 'GERAL',
      content: `Valores para atendimento particular na Atos Saúde Integrada:
- Consulta médica: R$ 800,00 no cartão de crédito
- Consulta médica: R$ 650,00 no PIX ou pagamento à vista
- Infusões e medicamentos: valores variáveis conforme o medicamento e duração do procedimento
  (o valor exato será informado pela equipe após análise do pedido médico)

Formas de pagamento aceitas:
- PIX (com desconto)
- Cartão de débito (sem acréscimo)
- Cartão de crédito (sem parcelamento, valor maior)
- Dinheiro / à vista (com desconto)`
    }
  ]

  for (const seed of seeds) {
    insertKnowledge(seed)
  }

  logger.info('Knowledge base seeds inseridos com sucesso.')
}
