/**
 * Scriba — Documentação clínica assistida por IA.
 *
 * Transcrição de áudio: OpenAI Whisper (mais robusto para pt-BR médico).
 * SOAP + knowledge: Claude via clinicalIntelligence.ts.
 */

import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'
import { db } from './db.ts'
import { clinicalSessions, soapNotes, conductAlerts } from '../drizzle/schema.ts'
import { eq, and, isNull, gte, isNotNull, desc, sql, gt, ne, inArray } from 'drizzle-orm'
import { encrypt } from './_core/encryption.ts'
import {
  gerarSOAP,
  gerarKnowledgeMetadata,
  extrairExamesLaboratoriais,
  detectarDivergenciaConducta,
  type KnowledgeMetadata,
  type FeedbackHistoricoItem,
} from './clinicalIntelligence.ts'
import { publicarNotaSOAP } from './obsidian.ts'
import { notificarSOAP } from './n8n.ts'

// ─── Whisper (OpenAI) ─────────────────────────────────────────────────────────
// Mantido com OpenAI: Whisper é o modelo de transcrição mais robusto disponível
// para português médico com sotaque regional. A API Claude não suporta áudio.

const WHISPER_CHUNK_BYTES = 10 * 1024 * 1024 // 10 MB

export async function transcribeAudio(audioBuffer: Buffer, filename = 'audio.webm'): Promise<string> {
  const apiKey = process.env['OPENAI_API_KEY'] ?? env.BUILT_IN_FORGE_API_KEY ?? ''
  if (!apiKey) throw new Error('Chave OpenAI não configurada (OPENAI_API_KEY)')

  const formData = new FormData()
  const ab = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength) as ArrayBuffer
  formData.append('file', new Blob([ab], { type: 'audio/webm' }), filename)
  formData.append('model', 'gpt-4o-mini-transcribe')
  formData.append('language', 'pt')

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(8 * 60 * 1000),
  })

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '')
    throw new Error(`Whisper error ${resp.status}: ${txt.slice(0, 200)}`)
  }

  const data = await resp.json() as { text: string }
  return data.text
}

export async function transcribeWithChunking(audioUrl: string): Promise<string> {
  const response = await fetch(audioUrl, { signal: AbortSignal.timeout(30_000) })
  const buffer = Buffer.from(await response.arrayBuffer())

  if (buffer.length <= WHISPER_CHUNK_BYTES) {
    return transcribeAudio(buffer)
  }

  logger.info('[scriba] Áudio grande — dividindo em chunks', {
    sizeMB: (buffer.length / 1024 / 1024).toFixed(1),
  })

  const transcriptions: string[] = []
  for (let i = 0, offset = 0; offset < buffer.length; i++, offset += WHISPER_CHUNK_BYTES) {
    const chunk = buffer.subarray(offset, offset + WHISPER_CHUNK_BYTES)
    try {
      transcriptions.push(await transcribeAudio(chunk, `chunk_${i}.webm`))
    } catch (err) {
      logger.error('[scriba] Chunk de áudio falhou', { chunk: i, error: String(err) })
    }
  }

  return transcriptions.join(' ')
}

// ─── Sessão clínica ───────────────────────────────────────────────────────────

export async function abrirSessao(medicoId: number): Promise<{ sessionId: number; nova: boolean }> {
  const inicioDia = new Date()
  inicioDia.setHours(0, 0, 0, 0)

  // Reutiliza sessão aberta do mesmo dia se existir
  const [existente] = await db
    .select({ id: clinicalSessions.id })
    .from(clinicalSessions)
    .where(and(
      eq(clinicalSessions.medicoId, medicoId),
      isNull(clinicalSessions.encerradaEm),
      gte(clinicalSessions.abertaEm, inicioDia),
    ))
    .limit(1)

  if (existente) {
    return { sessionId: existente.id, nova: false }
  }

  await db.insert(clinicalSessions).values({ medicoId })

  const [nova] = await db
    .select({ id: clinicalSessions.id })
    .from(clinicalSessions)
    .where(and(
      eq(clinicalSessions.medicoId, medicoId),
      isNull(clinicalSessions.encerradaEm),
      gte(clinicalSessions.abertaEm, inicioDia),
    ))
    .limit(1)

  if (!nova) throw new Error('[scriba] Sessão não encontrada após insert — inconsistência no banco')
  return { sessionId: nova.id, nova: true }
}

// ─── Processamento de consulta ────────────────────────────────────────────────

export interface ResultadoConsulta {
  soapNoteId: number
  soap: string
  knowledgeMetadata: KnowledgeMetadata
  alerta: {
    id: number
    nivelUrgencia: string
    mensagemMedico: string | null
  } | null
}

export async function processarConsulta(params: {
  sessionId: number
  medicoId: number
  /** Nome do paciente já encriptado via encryption.ts */
  pacienteNomeEncrypted: string
  transcricao: string
  template?: 'infectologia_geral' | 'prep_ist' | 'opat' | 'pos_transplante' | 'neutropenia_febril' | 'hiv_cronico' | 'tb'
  /** Se fornecida, roda detecção de divergência de conduta (Prompt 06) */
  sinteseEvidencias?: string
  /** Texto bruto do laudo laboratorial — Prompt 01 extrai estruturado antes do SOAP */
  examesTexto?: string
}): Promise<ResultadoConsulta> {
  const template = params.template ?? 'infectologia_geral'

  // ── Prompt 01: extração de exames (Haiku) — enriquece o SOAP com dados estruturados ──
  let dadosExamesJson: string | undefined
  if (params.examesTexto?.trim()) {
    try {
      const exames = await extrairExamesLaboratoriais(params.examesTexto)
      dadosExamesJson = JSON.stringify(exames)
      logger.info('[scriba] Exames extraídos via Prompt 01', {
        sessionId: params.sessionId,
        parametros: exames.metricas_extracao.total_parametros,
        criticos: exames.metricas_extracao.criticos,
      })
    } catch (err) {
      logger.warn('[scriba] Falha na extração de exames (Prompt 01) — SOAP gerado sem dados laboratoriais', { error: String(err) })
    }
  }

  // ── SOAP (CIS-02a, Sonnet) + knowledge_metadata (CIS-02b, Haiku) ─────────────
  logger.info('[scriba] Gerando SOAP', { sessionId: params.sessionId, template })
  const soap = await gerarSOAP({ transcricaoOuTexto: params.transcricao, dadosExamesJson, template })
  const knowledge_metadata = await gerarKnowledgeMetadata({ soapTexto: soap, template })

  const diag = knowledge_metadata.diagnostico_principal

  // ── Persiste soap_note + incrementa contador da sessão (atomic) ────────────
  const soapNoteId = await db.transaction(async (tx) => {
    await tx.insert(soapNotes).values({
      sessionId: params.sessionId,
      medicoId: params.medicoId,
      pacienteNomeEncrypted: params.pacienteNomeEncrypted,
      template,
      soapTexto: soap,
      knowledgeMetadata: knowledge_metadata,
      diagnosticoPrincipal: diag?.nome ?? null,
      cid10: diag?.cid10 ?? null,
      certeza: diag?.certeza ?? null,
      pubmedQuery: knowledge_metadata.busca_pubmed?.query_sugerida ?? null,
    })

    const [inserted] = await tx
      .select({ id: soapNotes.id })
      .from(soapNotes)
      .where(and(
        eq(soapNotes.sessionId, params.sessionId),
        eq(soapNotes.medicoId, params.medicoId),
      ))
      .orderBy(sql`${soapNotes.createdAt} DESC`)
      .limit(1)

    if (!inserted) throw new Error('[scriba] SOAP note não encontrada após insert — inconsistência no banco')

    await tx
      .update(clinicalSessions)
      .set({ totalConsultas: sql`${clinicalSessions.totalConsultas} + 1` })
      .where(eq(clinicalSessions.id, params.sessionId))

    return inserted.id
  })

  // ── Publica SOAP no Obsidian + notifica n8n se caso atípico (best-effort) ───
  publicarNotaSOAP({ soapNoteId, soapTexto: soap, metadata: knowledge_metadata }).catch(() => null)
  notificarSOAP({
    soapNoteId,
    diagnostico: diag?.nome ?? '',
    cid10: diag?.cid10 ?? '',
    casoAtipico: knowledge_metadata.caso_atipico.atipico,
    criteriosAtipicos: knowledge_metadata.caso_atipico.criterios_objetivos,
    tipoSugerido: knowledge_metadata.caso_atipico.tipo_sugerido,
  })

  // ── Enfileira síntese PubMed (Prompt 03) — best-effort, não bloqueia ────────
  if (knowledge_metadata.busca_pubmed?.query_sugerida) {
    try {
      const { enqueueSintesePubMed } = await import('./pubmedQueue.ts')
      const perfil = knowledge_metadata.perfil_paciente
      const populacao = [
        perfil.faixa_etaria,
        perfil.imunocomprometido ? `imunocomprometido (${perfil.tipo_imunocomprometimento ?? 'outro'})` : null,
        perfil.comorbidades.slice(0, 2).join(', '),
      ].filter(Boolean).join(', ')

      const condutaAtual = knowledge_metadata.conduta.antibioticos
        .map(a => `${a.nome} ${a.dose} ${a.via} ${a.frequencia} por ${a.duracao_dias}d`)
        .join('; ') || 'Sem antibióticos documentados'

      await enqueueSintesePubMed({
        soapNoteId,
        medicoId: params.medicoId,
        pubmedQuery: knowledge_metadata.busca_pubmed.query_sugerida,
        diagnosticoPrincipal: diag?.nome ?? '',
        cid10: diag?.cid10 ?? '',
        soapTexto: soap,
        condutaAtual,
        populacao,
        perfilPacienteJson: JSON.stringify(knowledge_metadata.perfil_paciente),
        template,
        termosMesh: knowledge_metadata.busca_pubmed.termos_mesh ?? [],
      })
      logger.info('[scriba] Síntese PubMed enfileirada', { soapNoteId })
    } catch (err) {
      logger.warn('[scriba] Falha ao enfileirar síntese PubMed', { error: String(err) })
    }
  }

  // ── Detecção de divergência (Claude — Prompt 06) ────────────────────────────
  // Só executa se síntese de evidências foi fornecida (requer PubMed — Frente 4)
  let alerta: ResultadoConsulta['alerta'] = null
  if (params.sinteseEvidencias && diag?.cid10) {
    // Verifica supressão ativa — se médico suprimiu alertas deste CID-10, pula a chamada ao LLM
    const [supressaoAtiva] = await db
      .select({ id: conductAlerts.id })
      .from(conductAlerts)
      .where(and(
        eq(conductAlerts.medicoId, params.medicoId),
        eq(conductAlerts.cid10, diag.cid10),
        gt(conductAlerts.supressaoAte, new Date()),
      ))
      .limit(1)

    if (supressaoAtiva) {
      logger.info('[scriba] Alerta suprimido — supressaoAte ativa', { soapNoteId, cid10: diag.cid10 })
    } else {
      try {
        const condutaAtual = knowledge_metadata.conduta.antibioticos
          .map(a => `${a.nome} ${a.dose} ${a.via} ${a.frequencia} por ${a.duracao_dias}d`)
          .join('; ') || 'Sem antibióticos documentados'

        // Busca histórico de feedback — mesmo CID-10 (até 10) + padrões descartados globalmente (até 5)
        const [feedbackCid10, feedbackGlobal] = await Promise.all([
          db.select({
            hashAlerta: conductAlerts.hashAlerta,
            feedbackMedico: conductAlerts.feedbackMedico,
            feedbackMotivo: conductAlerts.feedbackMotivo,
          })
          .from(conductAlerts)
          .where(and(
            eq(conductAlerts.medicoId, params.medicoId),
            eq(conductAlerts.cid10, diag.cid10),
            isNotNull(conductAlerts.feedbackMedico),
          ))
          .orderBy(desc(conductAlerts.feedbackEm))
          .limit(10),

          db.select({
            hashAlerta: conductAlerts.hashAlerta,
            feedbackMedico: conductAlerts.feedbackMedico,
            feedbackMotivo: conductAlerts.feedbackMotivo,
            cid10: conductAlerts.cid10,
          })
          .from(conductAlerts)
          .where(and(
            eq(conductAlerts.medicoId, params.medicoId),
            ne(conductAlerts.cid10, diag.cid10),
            inArray(conductAlerts.feedbackMedico, ['discordo', 'inaplicavel']),
          ))
          .orderBy(desc(conductAlerts.feedbackEm))
          .limit(5),
        ])

        const historicoFeedback: FeedbackHistoricoItem[] = [
          ...feedbackCid10.map(r => ({
            hashAlerta: r.hashAlerta,
            feedback: r.feedbackMedico!,
            motivo: r.feedbackMotivo,
          })),
          ...feedbackGlobal.map(r => ({
            hashAlerta: r.hashAlerta,
            feedback: r.feedbackMedico!,
            motivo: r.feedbackMotivo,
            cid10Origem: r.cid10 ?? undefined,
          })),
        ]

        const divergencia = await detectarDivergenciaConducta({
          condutaAtual,
          sinteseEvidencias: params.sinteseEvidencias,
          diagnostico: diag.nome,
          cid10: diag.cid10,
          perfilPaciente: knowledge_metadata.perfil_paciente,
          historicoFeedback,
        })

        if (divergencia.tem_divergencia && divergencia.nivel_urgencia) {
          await db.insert(conductAlerts).values({
            soapNoteId,
            medicoId: params.medicoId,
            diagnostico: diag.nome,
            cid10: diag.cid10,
            nivelUrgencia: divergencia.nivel_urgencia,
            hashAlerta: divergencia.hash_alerta ?? null,
            alertaJson: divergencia,
            mensagemMedico: divergencia.mensagem_para_medico,
          })

          const [alertaInserido] = await db
            .select({ id: conductAlerts.id })
            .from(conductAlerts)
            .where(eq(conductAlerts.soapNoteId, soapNoteId))
            .limit(1)

          if (!alertaInserido) throw new Error('[scriba] Alerta não encontrado após insert — inconsistência no banco')
          alerta = {
            id: alertaInserido.id,
            nivelUrgencia: divergencia.nivel_urgencia,
            mensagemMedico: divergencia.mensagem_para_medico,
          }

          logger.info('[scriba] Alerta de conduta registrado', {
            soapNoteId,
            urgencia: divergencia.nivel_urgencia,
          })
        }
      } catch (err) {
        // Divergência é best-effort — não bloqueia o fluxo principal
        logger.warn('[scriba] Detecção de divergência falhou', { error: String(err) })
      }
    }
  }

  return { soapNoteId, soap, knowledgeMetadata: knowledge_metadata, alerta }
}

// ─── Encerramento de sessão (dispara digest diário) ───────────────────────────

export async function encerrarSessao(sessionId: number, medicoId: number): Promise<void> {
  const agora = new Date()

  await db
    .update(clinicalSessions)
    .set({ encerradaEm: agora })
    .where(and(
      eq(clinicalSessions.id, sessionId),
      eq(clinicalSessions.medicoId, medicoId),
      isNull(clinicalSessions.encerradaEm),
    ))

  logger.info('[scriba] Sessão encerrada', { sessionId, medicoId })

  // Enfileira digest diário no BullMQ (digestQueue criado na próxima ação)
  try {
    const { enqueueDigestDiario } = await import('./digestQueue.ts')
    const periodoRef = agora.toISOString().slice(0, 10) // "YYYY-MM-DD"
    await enqueueDigestDiario({ medicoId, sessionId, periodoRef })
    logger.info('[scriba] Digest diário enfileirado', { medicoId, periodoRef })
  } catch (err) {
    logger.warn('[scriba] Falha ao enfileirar digest diário', { error: String(err) })
  }
}
