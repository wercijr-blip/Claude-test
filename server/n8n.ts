/**
 * n8n webhook helper — dispara notificações para workflows do n8n.
 *
 * Cada evento do CIS chama um webhook específico no n8n.
 * Se N8N_WEBHOOK_URL não estiver configurado, todas as chamadas são no-op.
 * Falhas nunca bloqueiam o fluxo principal (best-effort).
 */

import { env } from './_core/env.ts'
import { logger } from './_core/logger.ts'

function n8nDisponivel(): boolean {
  return Boolean(env.N8N_WEBHOOK_URL)
}

async function notificar(path: string, payload: Record<string, unknown>): Promise<void> {
  if (!n8nDisponivel()) return

  const url = `${env.N8N_WEBHOOK_URL!.replace(/\/$/, '')}/${path}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.N8N_WEBHOOK_SECRET ? { 'X-CIS-Secret': env.N8N_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      logger.warn('[n8n] Webhook retornou erro', { path, status: res.status })
    }
  } catch (err) {
    logger.warn('[n8n] Falha ao chamar webhook', { path, err: String(err) })
  }
}

// ─── Eventos públicos ─────────────────────────────────────────────────────────

/** Disparado após geração de SOAP — notifica se caso_atipico detectado. */
export function notificarSOAP(params: {
  soapNoteId: number
  diagnostico: string
  cid10: string
  casoAtipico: boolean
  criteriosAtipicos: string[]
  tipoSugerido: string
}): void {
  if (!params.casoAtipico) return
  notificar('webhook/cis-caso-atipico', params).catch(() => null)
}

/** Disparado quando alerta de conduta é gerado ou enriquecido com síntese PubMed. */
export function notificarAlertaConduta(params: {
  soapNoteId: number
  diagnostico: string
  cid10: string
  nivelUrgencia: string
  hashAlerta: string | null
  mensagemMedico: string | null
}): Promise<void> {
  return notificar('webhook/cis-alerta-conduta', params)
}

/** Disparado após geração de qualquer digest (diário/semanal/mensal). */
export function notificarDigest(params: {
  tipo: 'diario' | 'semanal' | 'mensal'
  periodoRef: string
  totalConsultas: number
  totalAlertas: number
  resumoTexto: string  // primeiros 800 chars para preview na notificação
}): void {
  notificar('webhook/cis-digest', {
    ...params,
    resumoTexto: params.resumoTexto.slice(0, 800),
  }).catch(() => null)
}
