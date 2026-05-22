import { z } from 'zod'

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

export const resultadoIaDbSchema = z.object({
  tipoExame: z.enum(['hiv', 'hepatite_b', 'hepatite_c', 'sifilis', 'creatinina', 'outro']),
  resultado: z.enum(['reagente', 'nao_reagente', 'inconclusivo', 'nao_identificado']),
  confianca: z.number().min(0).max(1),
  observacoes: z.string().optional(),
  processadoEm: z.string(),
  status: z.enum(['pendente', 'aprovado_automaticamente', 'rejeitado_ia', 'pendente_revisao', 'aprovado_medico', 'rejeitado_medico']),
}).nullable().catch(null)

export function parseDbJson<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value)
}
