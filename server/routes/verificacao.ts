/**
 * Endpoint público de verificação de documentos PrEP.
 *
 * O QR Code dos PDFs assinados aponta para `${APP_URL}/v/<tipoDoc>-<identifier>`.
 * Esta rota tRPC alimenta a página /v/:slug com metadados públicos do
 * documento, sem expor PII do paciente.
 *
 * Privacidade: não retornamos nome do paciente, CPF, dados clínicos ou
 * conteúdo do PDF. Quem escaneia o QR só vê:
 *   - tipo do documento
 *   - médico responsável + CRM (info pública)
 *   - data de emissão
 *   - serial do certificado ICP-Brasil
 *   - link para o validador ITI
 */

import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc.ts";
import { db } from "../db.ts";
import { pdfs, consultasInicio } from "../../drizzle/schema.ts";
import { eq, and, desc } from "drizzle-orm";
import { env } from "../_core/env.ts";

const TIPO_DOC_LABEL: Record<string, string> = {
  cadastro: "Cadastro de Usuário SUS PrEP",
  ficha: "Ficha de Atendimento PrEP",
  prescricao: "Receita PrEP",
  // 'formulario' mantido para compat com PDFs antigos (gerarFormularioPdf
  //  foi descontinuado, mas registros antigos em pdfs.tipo continuam).
  formulario: "Formulário Clínico PrEP",
  orientacao: "Documento de Orientação ao Paciente PrEP",
  pedido_completo: "Pedido de Exames Completo PrEP",
  pedido_ist: "Pedido de Sorológicos IST",
  pedido_hiv: "Pedido de Anti-HIV",
  pedido_densitometria: "Pedido de Densitometria Óssea",
  exame_anexado: "Exame Anti-HIV anexado pelo paciente",
};

// tipoDoc do QR → tipo armazenado em pdfs.tipo
const QR_TO_DB_TIPO: Record<string, string> = {
  cadastro: "cadastro",
  ficha: "ficha_atendimento",
  prescricao: "prescricao",
  formulario: "formulario",
  orientacao: "orientacao",
  pedido_completo: "pedido_completo",
  pedido_ist: "pedido_ist",
  pedido_hiv: "pedido_hiv",
  pedido_densitometria: "pedido_densitometria",
  exame_anexado: "exame_anexado",
};

export const verificacaoRouter = router({
  /**
   * Consulta metadados públicos de um documento via slug "tipo-id".
   * - Para cadastro/ficha/prescricao/formulario: id é pacienteId
   * - Para pedido_*: id é tokenId (consulta exame)
   */
  consultar: publicProcedure
    .input(z.object({ slug: z.string().max(100) }))
    .query(async ({ input }) => {
      // Parse "tipoDoc-identifier" — o tipoDoc pode ter underscores, então
      // dividimos no último '-'.
      const lastDash = input.slug.lastIndexOf("-");
      if (lastDash === -1) {
        return { encontrado: false as const };
      }
      const tipoDoc = input.slug.slice(0, lastDash);
      const idStr = input.slug.slice(lastDash + 1);
      const id = parseInt(idStr, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return { encontrado: false as const };
      }

      const tipoDb = QR_TO_DB_TIPO[tipoDoc];
      const label = TIPO_DOC_LABEL[tipoDoc];
      if (!tipoDb || !label) {
        return { encontrado: false as const };
      }

      let pacienteId: number | null = null;

      if (tipoDoc.startsWith("pedido_")) {
        // Pedidos de exame — id é tokenId; precisamos achar o pacienteId
        // associado àquele token, se houver.
        const [c] = await db
          .select({ id: consultasInicio.id })
          .from(consultasInicio)
          .where(eq(consultasInicio.tokenId, id))
          .limit(1);
        if (!c) return { encontrado: false as const };
        // Pedidos de exame ficam em pdfs também — pacienteId é null se o
        // paciente ainda não completou o cadastro. Por enquanto, mostramos
        // só info do tipo e do médico.
        return {
          encontrado: true as const,
          tipo: label,
          dataEmissao: null,
          medicoNome: env.MEDICO_NOME,
          medicoCrm: `${env.MEDICO_CRM_TIPO}/${env.MEDICO_CRM_UF} ${env.MEDICO_CRM}`,
          certificadoSerial: null,
          validadorIti: "https://verificador.iti.gov.br/",
        };
      }

      // Documentos vinculados a paciente
      pacienteId = id;
      const [doc] = await db
        .select({
          tipo: pdfs.tipo,
          assinadoEm: pdfs.assinadoEm,
          certificadoSerial: pdfs.certificadoSerial,
          createdAt: pdfs.createdAt,
        })
        .from(pdfs)
        .where(and(eq(pdfs.pacienteId, pacienteId), eq(pdfs.tipo, tipoDb)))
        .orderBy(desc(pdfs.createdAt))
        .limit(1);

      if (!doc) {
        return { encontrado: false as const };
      }

      return {
        encontrado: true as const,
        tipo: label,
        dataEmissao: (doc.assinadoEm ?? doc.createdAt).toISOString(),
        medicoNome: env.MEDICO_NOME,
        medicoCrm: `${env.MEDICO_CRM_TIPO}/${env.MEDICO_CRM_UF} ${env.MEDICO_CRM}`,
        certificadoSerial: doc.certificadoSerial,
        validadorIti: "https://verificador.iti.gov.br/",
      };
    }),
});
