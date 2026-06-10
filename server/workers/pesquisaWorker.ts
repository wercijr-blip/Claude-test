import { Worker } from "bullmq";
import { randomBytes } from "crypto";
import { env } from "../_core/env.ts";
import { db } from "../db.ts";
import { pesquisaTokens } from "../../drizzle/schema.ts";
import { enviarPesquisaSatisfacao } from "../email.ts";
import { enviarWhatsApp } from "../whatsapp.ts";
import { logger } from "../_core/logger.ts";
import {
  PESQUISA_QUEUE_NAME,
  QUEUE_PREFIX,
  connection,
  PESQUISA_WORKER_OPTS,
  persistDlq,
} from "./queues.ts";

export function startPesquisaWorker() {
  const worker = new Worker(
    PESQUISA_QUEUE_NAME,
    async (job) => {
      const { pacienteId, email, telefone, nome } = job.data as {
        pacienteId: number;
        email: string | null;
        telefone: string | null;
        nome: string;
      };

      const token = randomBytes(32).toString("hex");
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .insert(pesquisaTokens)
        .values({ pacienteId, token, expiraEm })
        .onDuplicateKeyUpdate({ set: { token, expiraEm } });
      const link = `${env.APP_URL}/pesquisa/${pacienteId}/${token}`;

      if (email) {
        await enviarPesquisaSatisfacao(email, nome, link).catch((e: unknown) =>
          logger.warn("[pesquisaQueue] notificação falhou", {
            error: String(e),
          }),
        );
      }

      if (telefone) {
        const primeiroNome = nome.split(" ")[0];
        const msg =
          `Olá ${primeiroNome}! Como foi sua experiência com o atendimento PrEP?\n\n` +
          `Leva menos de 1 minuto responder nossa pesquisa:\n${link}\n\n_Facilita PrEP_`;
        await enviarWhatsApp(telefone, msg).catch((e: unknown) =>
          logger.warn("[pesquisaQueue] notificação falhou", {
            error: String(e),
          }),
        );
      }
    },
    { connection, ...PESQUISA_WORKER_OPTS, prefix: QUEUE_PREFIX },
  );

  worker.on("failed", (job, err) => {
    logger.error(`[pesquisaQueue] Job ${job?.id} falhou`, {
      message: err.message,
    });
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3)) {
      void persistDlq(PESQUISA_QUEUE_NAME, job, err);
    }
  });

  return worker;
}
