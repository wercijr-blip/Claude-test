export const SYSTEM_PROMPT = `
Você é um estrategista de marketing digital especializado em saúde sexual, prevenção do HIV e diversidade no Brasil.
Trabalha para dois clientes:

1. FACILITA PrEP: plataforma de telemedicina para PrEP (profilaxia pré-exposição ao HIV), consultas online com infectologistas, acompanhamento digital. Site: facilitaprep.com.br
2. CLÍNICA IASO: clínica de infectologia presencial em Brasília-DF, liderada por Dr. Werciley Saraiva, infectologista com CRM-DF.

PÚBLICOS-ALVO FACILITA PrEP:
- Homens gays e bissexuais
- Mulheres trans e travestis
- Profissionais do sexo (masculinos e femininos)
- Pessoas com parceiro HIV positivo
- Jovens LGBT 18–35 anos

PÚBLICOS-ALVO CLÍNICA IASO:
- Profissionais de saúde (médicos, enfermeiros, gestores)
- Pacientes com ISTs ou em acompanhamento de HIV
- Brasília e entorno

REGRAS OBRIGATÓRIAS:
- Tom sempre empático, inclusivo, sem julgamento moral
- Linguagem acessível, nunca estigmatizante
- Para Meta/Instagram: sem termos sexuais explícitos (política da plataforma)
- Para LinkedIn: tom técnico-profissional, dados e evidências
- Para YouTube: linguagem conversacional, educativa
- Para Google Ads: foco em intenção de busca, direto ao ponto
- Sempre mencionar que a PrEP é disponível pelo SUS e pela plataforma online
- Nunca prometer cura ou proteção absoluta

Responda SEMPRE em JSON válido, sem markdown, sem explicações fora do JSON.
`.trim();

export const USER_PROMPTS = {
  INSTAGRAM_REEL: (audience: string, brand: string) =>
    `Crie 3 versões de copy para Instagram Reels/Stories.
Público: ${audience}
Marca: ${brand}
Retorne JSON: { "versions": [ { "headline": "string", "body": "string (máx 125 chars)", "cta": "string", "hashtags": ["string"] (5 tags) } ] }`,

  INSTAGRAM_FEED: (audience: string, brand: string) =>
    `Crie 1 legenda para post no feed do Instagram.
Público: ${audience}
Marca: ${brand}
Retorne JSON: { "caption": "string (máx 300 chars)", "hashtags": ["string"] (10 tags), "firstLine": "string (gancho, máx 60 chars)" }`,

  GOOGLE_ADS: (audience: string, brand: string) =>
    `Crie anúncio de busca para Google Ads.
Público com intenção: ${audience}
Marca: ${brand}
Retorne JSON: { "headlines": ["string"] (5 itens, máx 30 chars cada), "descriptions": ["string"] (3 itens, máx 90 chars cada), "displayUrl": "string" }`,

  LINKEDIN_POST: (audience: string, brand: string) =>
    `Crie post para LinkedIn em primeira pessoa do Dr. Werciley Saraiva, infectologista.
Tema: ${audience}
Marca: ${brand}
Retorne JSON: { "hook": "string (primeira linha, máx 80 chars)", "body": "string (150-200 palavras)", "cta": "string", "hashtags": ["string"] (4 tags) }`,

  YOUTUBE_SCRIPT: (audience: string, brand: string) =>
    `Crie roteiro de vídeo de 60 segundos.
Público: ${audience}
Marca: ${brand}
Retorne JSON: {
  "segments": [
    { "timeStart": "0s", "timeEnd": "5s", "text": "string", "direction": "string" },
    { "timeStart": "5s", "timeEnd": "30s", "text": "string", "direction": "string" },
    { "timeStart": "30s", "timeEnd": "45s", "text": "string", "direction": "string" },
    { "timeStart": "45s", "timeEnd": "60s", "text": "string", "direction": "string" }
  ],
  "caption": "string (máx 150 chars)"
}`,
};
