export type Role = 'user' | 'secretaria' | 'medico' | 'admin'

export type PacienteStatus =
  | 'rascunho'
  | 'pendente'
  | 'em_revisao'
  | 'aprovado'
  | 'rejeitado'

export type TokenTipo = 'privado' | 'convenio'

export type TipoExame =
  | 'hiv'
  | 'hepatite_b'
  | 'hepatite_c'
  | 'sifilis'
  | 'creatinina'
  | 'outro'

export type TipoAtendimento = 'particular' | 'convenio' | 'sus'

export interface Conduta {
  relacoesSexuais: {
    tipos: ('vaginal' | 'anal_receptivo' | 'anal_insertivo' | 'oral')[]
    frequencia: 'diaria' | 'semanal' | 'mensal' | 'esporadica'
    parceirosUltimos6Meses: number
    usaPreservativo: 'sempre' | 'quase_sempre' | 'as_vezes' | 'nunca'
  }
  historicoDst: boolean
  dstDescricao?: string
  prepAnterior: boolean
  prepPeriodo?: string
  usoDrogas: boolean
  drogasDescricao?: string
  outrasInformacoes?: string
}

export interface Prescricao {
  medicamento: 'tenofovir_emtricitabina' | 'outro'
  nomeMedicamento?: string
  posologia: string
  duracao: string
  observacoes?: string
}

export interface Autorizado {
  nome: string
  parentesco: string
  telefone?: string
}

export interface ResultadoIa {
  tipoExame: TipoExame
  resultado: 'reagente' | 'nao_reagente' | 'inconclusivo' | 'nao_identificado'
  confianca: number
  observacoes?: string
  processadoEm: string
  status?: 'pendente' | 'aprovado_automaticamente' | 'rejeitado_ia' | 'rejeitado' | 'pendente_revisao' | 'liberado_manualmente'
  observacoesMedico?: string | null
  liberadoEm?: string
}

export interface AuthUser {
  type: 'staff'
  id: number
  openId: string
  nome: string | null
  email: string | null
  role: Role
}

export interface PatientSession {
  type: 'patient'
  tokenId: number
  pacienteId: number | null
}
