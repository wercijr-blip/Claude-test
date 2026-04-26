// Públicos-alvo pré-configurados para campanhas

export const META_AUDIENCES = {
  lgbt_brasil: {
    age_min: 18,
    age_max: 45,
    geo_locations: { countries: ['BR'] },
    interests: [
      { id: '6003348918487', name: 'LGBT community' },
      { id: '6003664398958', name: 'Sexual health' },
      { id: '6003397425735', name: 'Grindr' },
      { id: '6003139266461', name: 'HIV/AIDS awareness' },
    ],
    locales: [4], // português
  },
  brasilia_geral: {
    age_min: 20,
    age_max: 55,
    geo_locations: {
      cities: [{ key: '2007577', radius: 30, distance_unit: 'kilometer' }],
    },
  },
  mulheres_trans_brasil: {
    age_min: 18,
    age_max: 45,
    geo_locations: { countries: ['BR'] },
    interests: [
      { id: '6003348918487', name: 'LGBT community' },
      { id: '6003664398958', name: 'Sexual health' },
    ],
    locales: [4],
  },
  profissionais_saude_brasilia: {
    age_min: 25,
    age_max: 60,
    geo_locations: {
      cities: [{ key: '2007577', radius: 40, distance_unit: 'kilometer' }],
    },
    behaviors: [{ id: '6015559085498', name: 'Health and wellness' }],
  },
};

export const GOOGLE_KEYWORDS_PREP = [
  'PrEP HIV prevenção',
  'onde fazer PrEP',
  'PrEP gratuito',
  'como tomar PrEP',
  'PrEP online consulta',
  'infectologista online',
  'infectologista Brasília',
  'clínica IST Brasília',
  'prevenção HIV remédio',
  'profilaxia pré exposição',
  'telemedicina infectologia',
];

export const LINKEDIN_TARGETING = {
  brasil: {
    include: {
      and: [
        { or: { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:105490917'] } }, // Brasil
        {
          or: {
            'urn:li:adTargetingFacet:industries': [
              'urn:li:industry:14', // Healthcare
              'urn:li:industry:96', // Medical Practice
            ],
          },
        },
      ],
    },
  },
  brasilia_saude: {
    include: {
      and: [
        { or: { 'urn:li:adTargetingFacet:locations': ['urn:li:geo:106485DF'] } }, // Brasília
        {
          or: {
            'urn:li:adTargetingFacet:jobFunctions': [
              'urn:li:function:8', // Healthcare
            ],
          },
        },
      ],
    },
  },
};

export const AUDIENCE_LABELS: Record<string, string> = {
  lgbt_adulto_brasil: 'Adultos LGBT no Brasil',
  profissionais_saude: 'Profissionais de Saúde',
  mulheres_trans: 'Mulheres Trans e Travestis',
  jovens_lgbt: 'Jovens LGBT 18-35 anos',
  brasilia_geral: 'Brasília e entorno (geral)',
  parceiros_hiv: 'Pessoas com parceiro HIV+',
};
