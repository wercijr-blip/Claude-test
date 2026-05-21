/**
 * WhatsApp audio endpoint — recebe URL de áudio de mensagem de voz (PTT)
 * enviada via Evolution API/n8n e processa a consulta automaticamente.
 *
 * POST /api/whatsapp/audio
 *   { audioUrl: string, nomeContato?: string, template?: string, tipoConsulta?: string }
 *   → { soapNoteId, diagnosticoPrincipal, cid10, alerta }
 */

import { timingSafeEqual } from "crypto";
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { env } from "../_core/env.ts";
import { logger } from "../_core/logger.ts";
import { encrypt } from "../_core/encryption.ts";
import {
  abrirSessao,
  processarConsulta,
  transcribeWithChunking,
} from "../scriba.ts";

type ValidTemplate =
  | "infectologia_geral"
  | "prep_ist"
  | "opat"
  | "pos_transplante"
  | "neutropenia_febril"
  | "hiv_cronico"
  | "tb";

const VALID_TEMPLATES = new Set<string>([
  "infectologia_geral",
  "prep_ist",
  "opat",
  "pos_transplante",
  "neutropenia_febril",
  "hiv_cronico",
  "tb",
]);

const VALID_TIPO = new Set([
  "primeira_consulta",
  "retorno",
  "seguimento",
]);

function ar(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);
}

function autenticar(req: Request, res: Response): number | null {
  if (!env.CIS_API_KEY || !env.CIS_MEDICO_USER_ID) {
    res.status(503).json({
      erro: "REST API do CIS não está configurada (CIS_API_KEY / CIS_MEDICO_USER_ID ausentes)",
    });
    return null;
  }
  const chave = req.headers["x-cis-api-key"];
  const valid =
    typeof chave === "string" &&
    chave.length === env.CIS_API_KEY!.length &&
    timingSafeEqual(Buffer.from(chave), Buffer.from(env.CIS_API_KEY!));
  if (!valid) {
    logger.warn("[whatsapp] Falha de autenticação", {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({ erro: "Chave de API inválida" });
    return null;
  }
  return env.CIS_MEDICO_USER_ID;
}

export const whatsappRouter = Router();

// ─── POST /api/whatsapp/audio ────────────────────────────────────────────────

whatsappRouter.post(
  "/audio",
  ar(async (req, res) => {
    const medicoId = autenticar(req, res);
    if (!medicoId) return;

    const { audioUrl, nomeContato, template, tipoConsulta } = req.body ?? {};

    if (typeof audioUrl !== "string" || !audioUrl.startsWith("https://")) {
      res.status(400).json({ erro: "audioUrl inválida (deve ser HTTPS)" });
      return;
    }

    const tmpl: ValidTemplate =
      typeof template === "string" && VALID_TEMPLATES.has(template)
        ? (template as ValidTemplate)
        : "infectologia_geral";

    const tipo =
      typeof tipoConsulta === "string" && VALID_TIPO.has(tipoConsulta)
        ? (tipoConsulta as "primeira_consulta" | "retorno" | "seguimento")
        : "primeira_consulta";

    const nome =
      typeof nomeContato === "string" && nomeContato.trim()
        ? nomeContato.trim().slice(0, 100)
        : "Paciente WhatsApp";

    logger.info("[whatsapp] Processando áudio", {
      medicoId,
      nomeContato: nome,
      template: tmpl,
      tipoConsulta: tipo,
    });

    const transcricao = await transcribeWithChunking(audioUrl);
    if (!transcricao.trim()) {
      res.status(422).json({
        erro: "Transcrição vazia — áudio sem conteúdo reconhecível",
      });
      return;
    }

    const { sessionId } = await abrirSessao(medicoId);
    const pacienteNomeEncrypted = encrypt(nome);

    const resultado = await processarConsulta({
      sessionId,
      medicoId,
      pacienteNomeEncrypted,
      transcricao,
      template: tmpl,
      tipoConsulta: tipo,
    });

    logger.info("[whatsapp] Consulta processada", {
      soapNoteId: resultado.soapNoteId,
      diagnostico: resultado.knowledgeMetadata.diagnostico_principal.nome,
      cid10: resultado.knowledgeMetadata.diagnostico_principal.cid10,
    });

    res.json({
      soapNoteId: resultado.soapNoteId,
      diagnosticoPrincipal:
        resultado.knowledgeMetadata.diagnostico_principal.nome,
      cid10: resultado.knowledgeMetadata.diagnostico_principal.cid10,
      alerta: resultado.alerta,
    });
  }),
);

// ─── Error handler ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
whatsappRouter.use(
  (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("[whatsapp] Erro inesperado", {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({ erro: "Erro interno ao processar áudio WhatsApp" });
  },
);
