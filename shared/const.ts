export const FORM_STEPS = [
  { step: 1, titulo: 'Dados Pessoais', rota: 'paciente' },
  { step: 2, titulo: 'Dados Demográficos', rota: 'demografico' },
  { step: 3, titulo: 'Contato', rota: 'contato' },
  { step: 4, titulo: 'Conduta', rota: 'conduta' },
  { step: 5, titulo: 'Prescrição', rota: 'prescricao' },
  { step: 6, titulo: 'Serviço', rota: 'servico' },
  { step: 7, titulo: 'Autorizados', rota: 'autorizados' },
  { step: 8, titulo: 'TCLE', rota: 'tcle' },
] as const

export const TOTAL_FORM_STEPS = 8

export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Não autorizado. Faça login para continuar.',
  FORBIDDEN: 'Acesso negado. Você não tem permissão para esta ação.',
  TOKEN_INVALID: 'Link inválido ou expirado.',
  TOKEN_USED: 'Este link já foi utilizado.',
  TOKEN_REVOKED: 'Este link foi revogado.',
  CPF_INVALID: 'CPF inválido.',
  NOT_FOUND: 'Registro não encontrado.',
  INTERNAL_ERROR: 'Erro interno. Tente novamente.',
  UPLOAD_SIZE: 'Arquivo muito grande. Máximo 10MB.',
  UPLOAD_TYPE: 'Tipo de arquivo não permitido.',
  RATE_LIMIT: 'Muitas tentativas. Aguarde e tente novamente.',
} as const

export const ROLES = {
  USER: 'user',
  SECRETARIA: 'secretaria',
  MEDICO: 'medico',
  ADMIN: 'admin',
} as const

export const PACIENTE_STATUS = {
  RASCUNHO: 'rascunho',
  PENDENTE: 'pendente',
  EM_REVISAO: 'em_revisao',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
} as const

export const COR_RACA_OPTIONS = [
  { value: 'branca', label: 'Branca' },
  { value: 'preta', label: 'Preta' },
  { value: 'parda', label: 'Parda' },
  { value: 'amarela', label: 'Amarela' },
  { value: 'indigena', label: 'Indígena' },
  { value: 'nao_informado', label: 'Prefiro não informar' },
] as const

export const ESCOLARIDADE_OPTIONS = [
  { value: 'sem_escolaridade', label: 'Sem escolaridade' },
  { value: 'fundamental_incompleto', label: 'Fundamental incompleto' },
  { value: 'fundamental_completo', label: 'Fundamental completo' },
  { value: 'medio_incompleto', label: 'Médio incompleto' },
  { value: 'medio_completo', label: 'Médio completo' },
  { value: 'superior_incompleto', label: 'Superior incompleto' },
  { value: 'superior_completo', label: 'Superior completo' },
  { value: 'pos_graduacao', label: 'Pós-graduação' },
] as const

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO',
  'MA','MT','MS','MG','PA','PB','PR','PE','PI',
  'RJ','RN','RS','RO','RR','SC','SP','SE','TO',
] as const

export const PLANOS_VALIDOS = [
  'AFEB BRASAL',
  'AFFEGO',
  'ASTE (ASETE)',
  'ASSEDF / VIDA CARD',
  'BACEN',
  'BOMBEIROS DF',
  'BRB SAÚDE',
  'CAEME-GO',
  'CAESAN',
  'CAIXA SAÚDE',
  'CAMED',
  'CARE PLUS',
  'CASEC (CODEVASF)',
  'CNTI',
  'CONAB',
  'E-VIDA (ELETRONORTE)',
  'EMB. DA AUSTRÁLIA',
  'EMB. COTE D\'IVOIRE',
  'EMB. DA DINAMARCA',
  'EMB. DA QUÊNIA',
  'EMBRATEL — DEMAIS PLANOS',
  'FACEB',
  'FAPES (BNDES)',
  'FASCAL',
  'FUSEX',
  'GAMA SAÚDE',
  'GRAVIA',
  'INFRAERO',
  'LIFE EMPRESARIAL',
  'MEDSENIOR',
  'NOTRE DAME',
  'OMINT SAÚDE',
  'PETROBRÁS DISTRIBUIDORA',
  'PETROBRÁS PETRÓLEO',
  'PLAN ASSISTE (MPF)',
  'PLAN ASSISTE (MPM)',
  'PLAN ASSISTE (MPT)',
  'PLAS/JMU (STM)',
  'PMDF',
  'POSTAL SAÚDE (ECT)',
  'PROASA',
  'PRÓ-SAÚDE (TJDFT)',
  'PRÓ-SOCIAL (TRF)',
  'REAL GRANDEZA',
  'SERPRO',
  'STF-MED (STF)',
  'SULAMÉRICA',
  'TRE SAÚDE',
  'TRT SAÚDE',
  'TST SAÚDE',
  'UNAFISCO (SINDIFISCO)',
  'Outro',
] as const

export const HORARIO_ATENDIMENTO = {
  ABERTURA_HORA: 8,
  FECHAMENTO_HORA: 18,
} as const

export const PRECADASTRO_STATUS = {
  AGUARDANDO_VALIDACAO: 'aguardando_validacao',
  AGUARDANDO_PAGAMENTO: 'aguardando_pagamento',
  LINK_ENVIADO: 'link_enviado',
  REJEITADO: 'rejeitado',
} as const

export const VALOR_CONSULTA_CENTAVOS = 25000 // R$ 250,00

export const TIPO_CONSULTA = {
  PRIMEIRO_ATENDIMENTO: 'primeiro_atendimento',
  JA_FACO_PREP: 'ja_faco_prep',
} as const

export const STATUS_EXAME = {
  AGUARDANDO_ESCOLHA: 'aguardando_escolha',
  AGUARDANDO_UPLOAD: 'aguardando_upload',
  EM_VALIDACAO_IA: 'em_validacao_ia',
  EM_VALIDACAO_MEDICA: 'em_validacao_medica',
  APROVADO: 'aprovado',
  REJEITADO: 'rejeitado',
} as const

export const MOTIVO_REJEICAO_EXAME = {
  ILEGIVEL: 'ilegivel',
  DATA_INVALIDA: 'data_invalida',
  NOME_DIVERGENTE: 'nome_divergente',
  RESULTADO_POSITIVO: 'resultado_positivo',
} as const

// ── Estrutura de exame com código TUSS ───────────────────────
export interface Exame {
  nome: string
  tuss: string
}

// ── Catálogo completo de exames disponíveis ───────────────────
export const CATALOGO_EXAMES = {
  // Hematologia
  HEMOGRAMA:            { nome: 'Hemograma Completo',                                           tuss: '40303858' },

  // Bioquímica / Função renal
  UREIA:                { nome: 'Ureia',                                                         tuss: '40302872' },
  CREATININA:           { nome: 'Creatinina',                                                    tuss: '40302163' },
  SODIO:                { nome: 'Sódio',                                                         tuss: '40302821' },
  POTASSIO:             { nome: 'Potássio',                                                      tuss: '40302694' },
  CALCIO_TOTAL:         { nome: 'Cálcio Total',                                                  tuss: '40302015' },
  CALCIO_IONICO:        { nome: 'Cálcio Iônico',                                                 tuss: '40302023' },
  MAGNESIO:             { nome: 'Magnésio',                                                      tuss: '40302279' },
  FOSFORO:              { nome: 'Fósforo',                                                       tuss: '40302538' },
  CREATININA_PROTEINA:  { nome: 'Creatinina + Proteinúria Isolada (relação proteína/creatinina)', tuss: '40302163' },
  PROTEINURIA:          { nome: 'Proteinúria Isolada (amostra)',                                 tuss: '40302724' },
  EAS:                  { nome: 'EAS (Urina Tipo I / Elementos Anormais e Sedimento)',            tuss: '40311017' },

  // Função hepática
  TGO:                  { nome: 'TGO (AST)',                                                     tuss: '40302848' },
  TGP:                  { nome: 'TGP (ALT)',                                                     tuss: '40302856' },
  FOSFATASE_ALC:        { nome: 'Fosfatase Alcalina (FA)',                                       tuss: '40302511' },
  GAMA_GT:              { nome: 'Gama GT (GGT)',                                                 tuss: '40302236' },
  PROTEINAS_TOTAIS:     { nome: 'Proteínas Totais e Frações (albumina/globulina)',               tuss: '40302708' },
  BILIRRUBINAS:         { nome: 'Bilirrubinas Totais e Frações',                                tuss: '40301958' },
  DHL:                  { nome: 'DHL (Desidrogenase Lática / LDH)',                              tuss: '40302198' },

  // Inflamação
  PCR:                  { nome: 'Proteína C Reativa (PCR)',                                      tuss: '40302716' },
  VHS:                  { nome: 'VHS (Velocidade de Hemossedimentação)',                         tuss: '40303904' },

  // Sífilis
  SIFILIS_VDRL:         { nome: 'Sífilis — VDRL',                                               tuss: '40302490' },
  SIFILIS_ECMIA:        { nome: 'Sífilis — ECMIa (quimioluminescência)',                         tuss: '40302511' },
  SIFILIS_FTA_IGM:      { nome: 'Sífilis — FTA-ABS IgM',                                        tuss: '40302201' },
  SIFILIS_FTA_IGG:      { nome: 'Sífilis — FTA-ABS IgG',                                        tuss: '40302201' },
  SIFILIS_TPHA:         { nome: 'Sífilis — TPHA/TPPA (confirmatório)',                           tuss: '40302503' },
  SIFILIS_TP_TOTAL:     { nome: 'Sífilis — Treponema pallidum, anticorpos totais',               tuss: '40302511' },

  // HIV / HTLV
  HIV:                  { nome: 'HIV 1 e 2 — Anticorpos',                                       tuss: '40301680' },
  HTLV:                 { nome: 'HTLV I e II — Anticorpos',                                     tuss: '40301699' },

  // Hepatite A
  HAV_TOTAL:            { nome: 'Sorologia Hepatite A — Anti-HAV Total',                         tuss: '40301028' },
  HAV_IGM:              { nome: 'Sorologia Hepatite A — Anti-HAV IgM',                           tuss: '40301036' },

  // Hepatite B
  HBSAG:                { nome: 'Hepatite B — HBsAg (antígeno de superfície)',                   tuss: '40301079' },
  ANTI_HBS:             { nome: 'Hepatite B — Anti-HBs (anticorpo)',                             tuss: '40301060' },
  ANTI_HBC_TOTAL:       { nome: 'Hepatite B — Anti-HBc Total',                                  tuss: '40301044' },
  ANTI_HBC_IGM:         { nome: 'Hepatite B — Anti-HBc IgM',                                    tuss: '40301052' },
  HBEAG:                { nome: 'Hepatite B — HBeAg',                                           tuss: '40301087' },
  ANTI_HBE:             { nome: 'Hepatite B — Anti-HBe',                                        tuss: '40301095' },

  // Hepatite C
  ANTI_HCV:             { nome: 'Hepatite C — Anti-HCV (sorologia)',                             tuss: '40301117' },

  // Herpes
  HSV_IGG:              { nome: 'Herpes Simplex — Anti-HSV IgG (tipos 1 e 2)',                  tuss: '40302252' },
  HSV_IGM:              { nome: 'Herpes Simplex — Anti-HSV IgM',                                tuss: '40302260' },

  // Clamídia
  CLAMÍDIA_IGG:         { nome: 'Sorologia Clamídia — IgG',                                     tuss: '40302074' },
  CLAMÍDIA_IGM:         { nome: 'Sorologia Clamídia — IgM',                                     tuss: '40302082' },
  CLAMÍDIA_PCR:         { nome: 'Chlamydia trachomatis — PCR (urina)',                           tuss: '40600912' },
  CLAMÍDIA_CULTURA:     { nome: 'Chlamydia trachomatis — Cultura',                              tuss: '40302082' },

  // Gonorreia
  GONORREIA_PCR:        { nome: 'Neisseria gonorrhoeae — PCR (urina)',                           tuss: '40600912' },
  GONORREIA_CULTURA:    { nome: 'Neisseria gonorrhoeae — Cultura (urina)',                       tuss: '40302279' },

  // Mycoplasma / Ureaplasma
  MYCOPLASMA:           { nome: 'Mycoplasma hominis — Cultura + TSA',                            tuss: '40302317' },
  UREAPLASMA:           { nome: 'Ureaplasma urealyticum/parvum — Cultura + TSA',                tuss: '40302325' },

  // Painel molecular
  PAINEL_IST_MOLECULAR: { nome: 'Painel IST Molecular',                                         tuss: '40600912' },

  // Densitometria óssea
  DENSITOMETRIA_LOMBAR: { nome: 'Densitometria óssea — coluna lombar (L1-L4)',                  tuss: '88.98.00' },
  DENSITOMETRIA_FEMUR:  { nome: 'Densitometria óssea — fêmur proximal bilateral',               tuss: '88.98.00' },
} as const satisfies Record<string, Exame>

// ── PDF 1 — Pedido Completo: Primeiro Atendimento ─────────────
export const EXAMES_PRIMEIRO_ATENDIMENTO: readonly Exame[] = [
  // Hematologia
  CATALOGO_EXAMES.HEMOGRAMA,
  // Bioquímica / Função renal
  CATALOGO_EXAMES.UREIA,
  CATALOGO_EXAMES.CREATININA,
  CATALOGO_EXAMES.SODIO,
  CATALOGO_EXAMES.POTASSIO,
  CATALOGO_EXAMES.CALCIO_TOTAL,
  CATALOGO_EXAMES.CALCIO_IONICO,
  CATALOGO_EXAMES.MAGNESIO,
  CATALOGO_EXAMES.FOSFORO,
  CATALOGO_EXAMES.EAS,
  CATALOGO_EXAMES.PROTEINURIA,
  CATALOGO_EXAMES.CREATININA_PROTEINA,
  // Função hepática
  CATALOGO_EXAMES.TGO,
  CATALOGO_EXAMES.TGP,
  CATALOGO_EXAMES.FOSFATASE_ALC,
  CATALOGO_EXAMES.GAMA_GT,
  CATALOGO_EXAMES.PROTEINAS_TOTAIS,
  CATALOGO_EXAMES.BILIRRUBINAS,
  CATALOGO_EXAMES.DHL,
  // Inflamação
  CATALOGO_EXAMES.PCR,
  CATALOGO_EXAMES.VHS,
  // Sífilis
  CATALOGO_EXAMES.SIFILIS_ECMIA,
  CATALOGO_EXAMES.SIFILIS_VDRL,
  CATALOGO_EXAMES.SIFILIS_FTA_IGM,
  CATALOGO_EXAMES.SIFILIS_FTA_IGG,
  CATALOGO_EXAMES.SIFILIS_TPHA,
  CATALOGO_EXAMES.SIFILIS_TP_TOTAL,
  // HIV / HTLV
  CATALOGO_EXAMES.HIV,
  CATALOGO_EXAMES.HTLV,
  // Hepatite A
  CATALOGO_EXAMES.HAV_TOTAL,
  CATALOGO_EXAMES.HAV_IGM,
  // Hepatite B
  CATALOGO_EXAMES.HBSAG,
  CATALOGO_EXAMES.ANTI_HBS,
  CATALOGO_EXAMES.ANTI_HBC_TOTAL,
  CATALOGO_EXAMES.ANTI_HBC_IGM,
  CATALOGO_EXAMES.HBEAG,
  CATALOGO_EXAMES.ANTI_HBE,
  // Hepatite C
  CATALOGO_EXAMES.ANTI_HCV,
  // Herpes
  CATALOGO_EXAMES.HSV_IGG,
  CATALOGO_EXAMES.HSV_IGM,
  // Clamídia
  CATALOGO_EXAMES.CLAMÍDIA_IGG,
  CATALOGO_EXAMES.CLAMÍDIA_IGM,
  CATALOGO_EXAMES.CLAMÍDIA_PCR,
  CATALOGO_EXAMES.CLAMÍDIA_CULTURA,
  // Gonorreia
  CATALOGO_EXAMES.GONORREIA_PCR,
  CATALOGO_EXAMES.GONORREIA_CULTURA,
  // Mycoplasma / Ureaplasma
  CATALOGO_EXAMES.MYCOPLASMA,
  CATALOGO_EXAMES.UREAPLASMA,
  // Painel molecular
  CATALOGO_EXAMES.PAINEL_IST_MOLECULAR,
]

// ── PDF 1 — Pedido Completo: Acompanhamento (já faz PrEP) ─────
export const EXAMES_FOLLOWUP_PREP: readonly Exame[] = [
  CATALOGO_EXAMES.HIV,
  CATALOGO_EXAMES.CREATININA,
  CATALOGO_EXAMES.HEMOGRAMA,
  CATALOGO_EXAMES.EAS,
]

// ── PDF 2 — Sorológicos de IST ────────────────────────────────
export const EXAMES_SOROLOGICOS_IST: readonly Exame[] = [
  CATALOGO_EXAMES.HIV,
  CATALOGO_EXAMES.SIFILIS_VDRL,
  CATALOGO_EXAMES.HBSAG,
  CATALOGO_EXAMES.ANTI_HBC_TOTAL,
  CATALOGO_EXAMES.ANTI_HCV,
  CATALOGO_EXAMES.CLAMÍDIA_PCR,
  CATALOGO_EXAMES.GONORREIA_PCR,
]

// ── PDF 3 — Anti-HIV isolado ──────────────────────────────────
export const EXAMES_HIV_ISOLADO: readonly Exame[] = [
  CATALOGO_EXAMES.HIV,
]

// ── PDF 4 — Densitometria Óssea ───────────────────────────────
export const EXAMES_DENSITOMETRIA: readonly Exame[] = [
  CATALOGO_EXAMES.DENSITOMETRIA_LOMBAR,
  CATALOGO_EXAMES.DENSITOMETRIA_FEMUR,
]

export const DIAS_VALIDADE_EXAME = 7
export const DIAS_VALIDADE_LINK_UPLOAD = 7
