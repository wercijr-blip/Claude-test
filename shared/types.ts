export type Role = "user" | "secretaria" | "medico" | "admin";

export type PacienteStatus =
  | "rascunho"
  | "pendente"
  | "em_revisao"
  | "aprovado"
  | "rejeitado";

export type TokenTipo = "privado" | "convenio";

export type TipoExame =
  | "hiv"
  | "hepatite_b"
  | "hepatite_c"
  | "sifilis"
  | "creatinina"
  | "outro";

export type TipoAtendimento = "particular" | "convenio" | "sus";

export interface Conduta {
  relacoesSexuais: {
    tipos: ("vaginal" | "anal_receptivo" | "anal_insertivo" | "oral")[];
    frequencia: "diaria" | "semanal" | "mensal" | "esporadica";
    parceirosUltimos6Meses: number;
    usaPreservativo: "sempre" | "quase_sempre" | "as_vezes" | "nunca";
  };
  historicoDst: boolean;
  dstDescricao?: string;
  prepAnterior: boolean;
  prepPeriodo?: string;
  usoDrogas: boolean;
  drogasDescricao?: string;
  outrasInformacoes?: string;
}

export interface Prescricao {
  medicamento: "tenofovir_emtricitabina" | "outro";
  nomeMedicamento?: string;
  posologia: string;
  duracao: string;
  observacoes?: string;
}

export interface Autorizado {
  nome: string;
  parentesco: string;
  telefone?: string;
}

/**
 * Metadados de conformidade SBIS anexados a toda saída gerada por IA.
 * Cobre: BPIA.01–05, ECF.16–17, NGS1.01, NGS1.07
 */
export interface SbisMetadata {
  /** ISO 8601 — ECF.17 */
  timestamp: string;
  /** UUID da sessão de análise — ECF.17 */
  sessionId: string;
  /** Identificador do modelo LLM utilizado — NGS1.01 / BPIA.02 */
  modelVersion: string;
  /** Versão da plataforma — NGS1.01 */
  systemVersion: string;
  /** SHA-256 (16 chars) do conteúdo do resultado — ECF.17 rastreabilidade */
  hash: string;
  /** Responsável Técnico — BPIA.01 / ECF.02 */
  responsavelTecnico: {
    nome: string;
    crm: string;
    rqe: string;
    especialidade: string;
  };
  /** Grau de confiança mapeado do score numérico — BPIA.02 / Seção 2.4 v2.0 */
  grauConfianca: "Alto" | "Moderado" | "Baixo" | "Insuficiente";
  /** Versão do guideline SBIS aplicado — ECF.NOVO */
  guidelinesVersion?: string;
  /** Diretrizes clínicas que fundamentam a análise — BPIA.04 */
  fundamentacao: string[];
  /** Limitações conhecidas desta análise — BPIA.04 */
  limitacoes: string[];
  /** Nível SBIS de maturidade — BPIA.01 */
  nivel: string;
  /** Aviso de conformidade obrigatório — ECF.16 */
  aviso: string;
}

// Single source of truth for resultadoIa.status values.
// Imported by dbSchemas.ts (Zod enum) and used here for the TypeScript union.
export const IA_RESULTADO_STATUS = [
  "pendente",
  "aprovado_automaticamente",
  "rejeitado_ia",
  "pendente_revisao",
  "rejeitado",
  "liberado_manualmente",
  "aprovado_medico",
  "rejeitado_medico",
] as const;

export type IaResultadoStatus = (typeof IA_RESULTADO_STATUS)[number];

export interface ResultadoIa {
  tipoExame: TipoExame;
  resultado: "reagente" | "nao_reagente" | "inconclusivo" | "nao_identificado";
  confianca: number;
  observacoes?: string;
  processadoEm: string;
  status?: IaResultadoStatus;
  observacoesMedico?: string | null;
  liberadoEm?: string;
  /** Metadados de conformidade SBIS — presente em toda saída gerada por IA após v1.0 */
  sbis?: SbisMetadata;
}

export interface AuthUser {
  type: "staff";
  id: number;
  openId: string;
  nome: string | null;
  email: string | null;
  role: Role;
  totpEnabled: boolean;
}

export interface PatientSession {
  type: "patient";
  tokenId: number;
  pacienteId: number | null;
}
