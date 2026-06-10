import { enviarWhatsApp } from "./whatsapp.ts";
import { env } from "./_core/env.ts";
import { redis } from "./_core/redis.ts";
import { logger } from "./_core/logger.ts";

export const staffTemplates = {
  medicoExameParaRevisar: () =>
    `🩺 *Facilita PrEP* — exame aguardando revisão médica.\nAcessar: ${env.APP_URL}/medico`.trim(),

  medicoExameUrgente: () =>
    `🚨 *Facilita PrEP* — URGENTE: resultado possivelmente reagente. Revisão imediata necessária.\nAcessar: ${env.APP_URL}/medico`.trim(),

  secretariaPlanoSaudePendente: () =>
    `📋 *Facilita PrEP* — novo cadastro de plano de saúde aguardando verificação.\nAcessar: ${env.APP_URL}/secretaria`.trim(),
};

async function podeEnviarStaffWhatsapp(
  papel: "medico" | "secretaria",
  tipo: string,
): Promise<boolean> {
  const key = `wpp:staff:${papel}:${tipo}`;
  try {
    const ja = await redis.get(key);
    if (ja) return false;
    await redis.set(key, "1", "EX", 300);
    return true;
  } catch {
    // Redis indisponível — permite envio (melhor enviar duplicado que não enviar)
    return true;
  }
}

export async function notificarStaff(
  papel: "medico" | "secretaria",
  tipo: string,
  template: () => string,
): Promise<void> {
  const numero =
    papel === "medico"
      ? env.STAFF_WHATSAPP_MEDICOS
      : env.STAFF_WHATSAPP_SECRETARIAS;
  if (!numero) return;

  if (!(await podeEnviarStaffWhatsapp(papel, tipo))) return;

  const ok = await enviarWhatsApp(numero, template());
  if (!ok) {
    // Loga falha sem expor o número completo (LGPD)
    const mascarado = `${numero.slice(0, 4)}****${numero.slice(-2)}`;
    logger.warn("[staff-whatsapp] falha ao enviar", {
      papel,
      tipo,
      numero: mascarado,
    });
  }
}
