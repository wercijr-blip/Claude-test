import { db } from "./db.ts";
import { exames, pacientes } from "../drizzle/schema.ts";
import { eq } from "drizzle-orm";
import { logger } from "./_core/logger.ts";
import { EXAM_RULES } from "../shared/security-constants.ts";
import type { ResultadoIa } from "../shared/types.ts";

export async function processarResultadoIa(
  exameId: number,
  pacienteId: number,
  resultado: ResultadoIa,
  logCtx: object,
): Promise<ResultadoIa> {
  if (
    resultado.resultado === "nao_reagente" &&
    resultado.confianca >= EXAM_RULES.AUTO_APPROVE_MIN_CONFIDENCE
  ) {
    const novoResultado: ResultadoIa = {
      ...resultado,
      status: "aprovado_automaticamente",
    };
    await db.transaction(async (tx) => {
      await tx
        .update(exames)
        .set({ resultadoIa: novoResultado })
        .where(eq(exames.id, exameId));
      await tx
        .update(pacientes)
        .set({ status: "aprovado" })
        .where(eq(pacientes.id, pacienteId));
    });
    logger.info(`[examApproval] Exame ${exameId} aprovado automaticamente`, {
      ...logCtx,
      confianca: resultado.confianca,
      pacienteId,
    });
    return novoResultado;
  }

  if (
    resultado.resultado === "reagente" ||
    resultado.confianca < EXAM_RULES.LOW_CONFIDENCE_THRESHOLD
  ) {
    const novoResultado: ResultadoIa = { ...resultado, status: "rejeitado_ia" };
    await db
      .update(exames)
      .set({ resultadoIa: novoResultado })
      .where(eq(exames.id, exameId));
    logger.warn(`[examApproval] Exame ${exameId} rejeitado pela IA`, {
      ...logCtx,
      resultado: resultado.resultado,
      confianca: resultado.confianca,
    });
    logger.info(
      `[examApproval] Notificação pendente: exame ${exameId} aguarda revisão médica`,
      {
        ...logCtx,
        motivo: "resultado_reagente",
      },
    );
    return novoResultado;
  }

  // Inconclusive or unidentified → flag for medico review
  const novoResultado: ResultadoIa = {
    ...resultado,
    status: "pendente_revisao",
  };
  await db
    .update(exames)
    .set({ resultadoIa: novoResultado })
    .where(eq(exames.id, exameId));
  logger.warn(`[examApproval] Exame ${exameId} inconclusivo`, {
    ...logCtx,
    resultado: resultado.resultado,
    confianca: resultado.confianca,
  });
  logger.info(
    `[examApproval] Notificação pendente: exame ${exameId} aguarda revisão médica`,
    {
      ...logCtx,
      motivo: "resultado_inconclusivo",
    },
  );
  return novoResultado;
}
