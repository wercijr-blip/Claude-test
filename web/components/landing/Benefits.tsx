const benefits = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Atendimento sigiloso e sem julgamento',
    desc: 'Seus dados são criptografados e nenhuma informação sensível é compartilhada. Cuide da sua saúde com total privacidade, de onde estiver.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: 'Médico especialista em ISTs',
    desc: 'Dr. Werciley Saraiva, infectologista com CRM/DF 16381 e RQE 14486, especializado em prevenção do HIV e doenças sexualmente transmissíveis.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 3v4h4" />
      </svg>
    ),
    title: 'Receita digital ICP-Brasil válida em todo Brasil',
    desc: 'A assinatura digital ICP-Brasil tem validade jurídica plena e é aceita em qualquer farmácia do país — física ou convênio.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h8" />
      </svg>
    ),
    title: 'Acompanhamento contínuo com seu médico',
    desc: 'O protocolo PrEP exige revisões a cada 3 meses. Nossa plataforma facilita todo esse acompanhamento de forma simples e online, sem burocracia.',
  },
]

export default function Benefits() {
  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Diferenciais</p>
          <h2 className="font-display text-4xl sm:text-5xl text-fp-dark">Por que escolher Facilita PrEP</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="flex gap-5 bg-fp-fog rounded-3xl p-7 border border-fp-lavender-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl bg-fp-lavender-50 flex items-center justify-center text-fp-accent shrink-0">
                {b.icon}
              </div>
              <div>
                <h3 className="font-semibold text-fp-dark text-base mb-1.5 leading-snug">{b.title}</h3>
                <p className="text-fp-dark-soft text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
