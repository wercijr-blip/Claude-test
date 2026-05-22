/**
 * CIS shared API client, model constants, Opus budget, and core helpers.
 * Imported by all CIS sub-modules.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Sentry } from "../_core/instrument.ts";
import { env } from "../_core/env.ts";
import { logger } from "../_core/logger.ts";
import { redis } from "../_core/redis.ts";
import {
  INTEGRITY_GUARD,
  INJECTION_GUARD,
  PII_GUARD,
  OUTPUT_CONTRACT_JSON,
  EVIDENCE_GRADING,
  DIGEST_BASE,
} from "./blocks.ts";

export {
  INTEGRITY_GUARD,
  INJECTION_GUARD,
  PII_GUARD,
  OUTPUT_CONTRACT_JSON,
  EVIDENCE_GRADING,
};

// ─── Model constants ──────────────────────────────────────────────────────────

export const MODEL_HAIKU = "claude-haiku-4-5"; // CIS-01, CIS-02b, CIS-04
export const MODEL_SONNET = "claude-sonnet-4-6"; // CIS-02a, CIS-03, CIS-05–09
export const MODEL_OPUS = "claude-opus-4-7"; // CIS-10, CIS-11

const anthropic = new Anthropic({
  apiKey: env.BUILT_IN_FORGE_API_KEY ?? "",
  baseURL: env.BUILT_IN_FORGE_API_URL,
});

// ─── Opus daily budget (Redis counter) ───────────────────────────────────────

function opusDateKey(): string {
  const BRT_OFFSET = -3 * 60 * 60_000;
  const brtDate = new Date(Date.now() + BRT_OFFSET).toISOString().slice(0, 10);
  return `cis:opus:tokens:${brtDate}`;
}

async function getOpusTokensToday(): Promise<number> {
  try {
    const val = await redis.get(opusDateKey());
    if (!val) return 0;
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    // Redis indisponível — propaga erro para callClaude fazer downgrade defensivo
    throw new Error("redis_unavailable");
  }
}

async function incrOpusTokens(tokens: number): Promise<void> {
  try {
    const key = opusDateKey();
    const newVal = await redis.incrby(key, tokens);
    if (newVal <= tokens) {
      // Primeira incrementação do dia — define TTL de 48h (mantém dado de ontem para auditoria)
      await redis.expire(key, 48 * 3600);
    }
  } catch {
    // Falha no rastreamento não é crítica — apenas registra silenciosamente
  }
}

/** Retorna status atual do orçamento diário de Opus para monitoramento. */
export async function getOpusBudgetStatus(): Promise<{
  usado: number;
  limite: number;
  percentual: number;
  dataKey: string;
}> {
  const usado = await getOpusTokensToday();
  const limite = env.OPUS_DAILY_TOKEN_BUDGET;
  return {
    usado,
    limite,
    percentual:
      limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0,
    dataKey: opusDateKey(),
  };
}

// Status codes that warrant a retry with exponential backoff
export const RETRYABLE_STATUS = new Set([429, 502, 503]);
export const MAX_API_RETRIES = 3;

export async function callClaude(
  systemPrompt: string,
  userContent: string,
  maxTokens: number,
  model = MODEL_SONNET,
  temperature?: number,
  fnName = "",
): Promise<string> {
  // Verifica orçamento diário antes de chamar Opus
  let effectiveModel = model;
  if (model === MODEL_OPUS && env.OPUS_DAILY_TOKEN_BUDGET > 0) {
    let tokensHoje: number;
    try {
      tokensHoje = await getOpusTokensToday();
    } catch {
      // Redis indisponível — fail-safe: usa Sonnet para evitar uso não-contabilizado de Opus
      logger.warn(
        "[cis] Redis indisponível para verificação de budget — downgrade defensivo para Sonnet",
      );
      effectiveModel = MODEL_SONNET;
      return callClaude(
        systemPrompt,
        userContent,
        maxTokens,
        MODEL_SONNET,
        temperature,
        fnName,
      );
    }
    const limiteAlerta = Math.floor(env.OPUS_DAILY_TOKEN_BUDGET * 0.8);
    if (
      tokensHoje >= limiteAlerta &&
      tokensHoje < env.OPUS_DAILY_TOKEN_BUDGET
    ) {
      logger.warn(
        "[cis] Orçamento Opus em 80% — considere aumentar OPUS_DAILY_TOKEN_BUDGET",
        {
          tokensHoje,
          limiteAlerta,
          limite: env.OPUS_DAILY_TOKEN_BUDGET,
          percentual: Math.round(
            (tokensHoje / env.OPUS_DAILY_TOKEN_BUDGET) * 100,
          ),
        },
      );
      Sentry.captureMessage("[cis] Orçamento Opus em 80%", {
        level: "warning",
        extra: { tokensHoje, limite: env.OPUS_DAILY_TOKEN_BUDGET },
      });
    }
    if (tokensHoje >= env.OPUS_DAILY_TOKEN_BUDGET) {
      logger.warn(
        "[cis] Orçamento diário de Opus atingido — downgrade para Sonnet",
        {
          tokensHoje,
          limite: env.OPUS_DAILY_TOKEN_BUDGET,
        },
      );
      effectiveModel = MODEL_SONNET;
    }
  }

  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const response = await anthropic.messages.create({
        model: effectiveModel,
        max_tokens: maxTokens,
        // System as array enables prompt caching for static system prompts.
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userContent }],
        // Opus 4.7 removed temperature/top_p/top_k — omit them to avoid 400 errors.
        ...(temperature !== undefined && effectiveModel !== MODEL_OPUS
          ? { temperature }
          : {}),
      });

      // Registra tokens consumidos se chamada Opus foi efetivamente executada
      if (effectiveModel === MODEL_OPUS) {
        const total =
          (response.usage.input_tokens ?? 0) +
          (response.usage.output_tokens ?? 0);
        await incrOpusTokens(total);
        logger.info("[cis] Tokens Opus registrados", {
          total,
          key: opusDateKey(),
        });
      }

      logger.info("[cis] latência", {
        fn: fnName,
        model: effectiveModel,
        ms: Date.now() - start,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      const block = response.content[0];
      return block?.type === "text" ? block.text : "";
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        if (RETRYABLE_STATUS.has(err.status) && attempt < MAX_API_RETRIES) {
          const delayMs = 2 ** attempt * 1000; // 1s → 2s → 4s
          logger.warn("[cis] Erro transiente na API — aguardando para retry", {
            attempt: attempt + 1,
            status: err.status,
            delayMs,
            model: effectiveModel,
          });
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        logger.error("[cis] Erro na API Anthropic", {
          status: err.status,
          message: err.message,
          model: effectiveModel,
        });
        throw new Error(
          `Erro na API de IA (HTTP ${err.status}): ${err.message}`,
        );
      }
      throw err;
    }
  }
  // Unreachable — loop always returns or throws
  throw new Error("[cis] callClaude: estado inesperado após retries");
}

// ─── Batch API ────────────────────────────────────────────────────────────────

export interface BatchRequest {
  id: string;
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  model?: string;
  temperature?: number;
}

/**
 * Submits multiple independent Claude requests as one batch job — 50% cheaper.
 * Polls until all requests complete or timeout is reached.
 * Returns a Map<id, text>; failed/expired requests map to empty string.
 */
export async function callClaudeBatch(
  requests: BatchRequest[],
  { pollIntervalMs = 30_000, timeoutMs = 30 * 60_000 } = {},
): Promise<Map<string, string>> {
  if (requests.length === 0) return new Map();

  const batch = await anthropic.messages.batches.create({
    requests: requests.map((r) => ({
      custom_id: r.id,
      params: {
        model: r.model ?? MODEL_SONNET,
        max_tokens: r.maxTokens,
        system: [
          {
            type: "text" as const,
            text: r.systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user" as const, content: r.userContent }],
        ...(r.temperature !== undefined &&
        (r.model ?? MODEL_SONNET) !== MODEL_OPUS
          ? { temperature: r.temperature }
          : {}),
      },
    })),
  });

  logger.info("[cis] Batch submetido", {
    batchId: batch.id,
    n: requests.length,
  });

  const deadline = Date.now() + timeoutMs;
  let current = batch;
  while (current.processing_status !== "ended") {
    if (Date.now() > deadline) {
      await anthropic.messages.batches.cancel(batch.id).catch(() => null);
      throw new Error(
        `[cis] Batch timeout após ${timeoutMs / 60_000} min (id: ${batch.id})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    current = await anthropic.messages.batches.retrieve(batch.id);
    logger.info("[cis] Batch aguardando", {
      batchId: batch.id,
      processing: current.request_counts.processing,
      succeeded: current.request_counts.succeeded,
    });
  }

  const results = new Map<string, string>();
  for await (const result of await anthropic.messages.batches.results(
    batch.id,
  )) {
    if (result.result.type === "succeeded") {
      const block = result.result.message.content[0];
      results.set(result.custom_id, block?.type === "text" ? block.text : "");
    } else {
      logger.warn("[cis] Batch request falhou", {
        id: result.custom_id,
        type: result.result.type,
      });
      results.set(result.custom_id, "");
    }
  }

  logger.info("[cis] Batch concluído", {
    batchId: batch.id,
    resultados: results.size,
  });
  return results;
}

export function parseJsonResponse<T>(text: string, context: string): T {
  // Strip markdown code fences if the model wrapped the JSON in ```json … ```
  const stripped = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1] ?? text;
  const match = stripped.match(/\{[\s\S]*\}/);
  const jsonStr = match ? match[0] : stripped;
  try {
    return JSON.parse(jsonStr) as T;
  } catch (err) {
    logger.error(`[clinicalIntelligence] Falha ao parsear JSON — ${context}`, {
      error: (err as Error).message,
      preview: text.slice(0, 300),
    });
    throw new Error(`Resposta da IA não é JSON válido (${context})`);
  }
}

// ─── Global variables injected into prompts ───────────────────────────────────

export const MEDICO = {
  nome: env.MEDICO_NOME,
  crm: `CRM-${env.MEDICO_CRM_UF} ${env.MEDICO_CRM}`,
  rqe: env.MEDICO_RQE,
  especialidade: "Infectologia",
  cbo: "2251-50",
  clinicaNome: env.CLINICA_NOME,
  cnes: env.SUS_CNES,
};

export const DIGEST_BASE_STR = DIGEST_BASE(MEDICO.nome, MEDICO.crm);
