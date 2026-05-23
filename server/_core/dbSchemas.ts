import { z } from 'zod'
import { IA_RESULTADO_STATUS } from '../../shared/types.ts'

export const condutaDbSchema = z.object({
  temSintomasDst: z.boolean(),
  usoDrogas: z.boolean(),
  prepAdesao: z.enum(['diaria', 'sob_demanda']).optional(),
}).nullable().catch(null)

export const prescricaoDbSchema = z.object({
  modalidade: z.string(),
  posologia: z.string(),
  medicamento: z.string().optional(),
  dataInicio: z.string().optional(),
  observacoes: z.string().optional(),
}).nullable().catch(null)

// SBIS metadata sub-schema — ECF.17 / BPIA.01–04
const sbisMetadataDbSchema = z.object({
  timestamp: z.string(),
  sessionId: z.string(),
  modelVersion: z.string(),
  systemVersion: z.string(),
  hash: z.string(),
  responsavelTecnico: z.object({
    nome: z.string(),
    crm: z.string(),
    rqe: z.string(),
    especialidade: z.string(),
  }),
  grauConfianca: z.enum(['Alto', 'Moderado', 'Baixo']),
  fundamentacao: z.array(z.string()),
  limitacoes: z.array(z.string()),
  nivel: z.string(),
  aviso: z.string(),
}).optional()

export const resultadoIaDbSchema = z.object({
  tipoExame: z.enum(['hiv', 'hepatite_b', 'hepatite_c', 'sifilis', 'creatinina', 'outro']),
  resultado: z.enum(['reagente', 'nao_reagente', 'inconclusivo', 'nao_identificado']),
  confianca: z.number().min(0).max(1),
  observacoes: z.string().optional(),
  processadoEm: z.string(),
  status: z.enum(IA_RESULTADO_STATUS),
  sbis: sbisMetadataDbSchema,
}).nullable().catch(null)

export function parseDbJson<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value)
}
