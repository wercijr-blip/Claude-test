const testimonials = [
  {
    initials: 'CM',
    gradient: 'from-[#B890D0] to-[#7C4A9E]',
    name: 'Carlos M., 32 anos',
    city: 'São Paulo, SP',
    text: 'Todo o processo foi incrivelmente discreto. Preenchi o formulário em casa, enviei os exames e recebi a receita no dia seguinte. Nunca precisei me explicar para ninguém.',
    stars: 5,
  },
  {
    initials: 'FO',
    gradient: 'from-[#88AACE] to-[#4A73A0]',
    name: 'Felipe O., 27 anos',
    city: 'Curitiba, PR',
    text: 'Morava longe de qualquer serviço que oferecesse PrEP. A Facilita PrEP resolveu isso em menos de 24 horas. Não preciso mais depender do SUS da minha cidade.',
    stars: 5,
  },
  {
    initials: 'RP',
    gradient: 'from-[#7DBFA0] to-[#3D8A63]',
    name: 'Rafael P., 35 anos',
    city: 'Brasília, DF',
    text: 'O sigilo fez toda a diferença para mim. Fiz tudo online, sem precisar me expor. O médico foi atencioso, tirou todas as dúvidas e a receita chegou rapidíssimo.',
    stars: 5,
  },
]

export default function Testimonials() {
  return (
    <section className="py-20 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14">
          <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Depoimentos</p>
          <h2 className="font-display text-4xl sm:text-5xl text-fp-dark leading-tight">
            Histórias de quem cuida<br className="hidden sm:block" /> da saúde com a gente
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-7 border border-fp-lavender-100 shadow-sm flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-5">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <svg key={j} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Quote */}
              <p className="text-fp-dark-soft text-sm leading-relaxed flex-1 mb-6">"{t.text}"</p>

              {/* Author */}
              <div className="flex items-center gap-3 border-t border-fp-lavender-100 pt-5">
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.gradient} flex items-center justify-center shrink-0`}
                >
                  <span className="text-white text-xs font-bold tracking-wider">{t.initials}</span>
                </div>
                <div>
                  <p className="font-semibold text-fp-dark text-sm">{t.name}</p>
                  <p className="text-fp-dark-soft text-xs">{t.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-fp-dark-soft text-xs mt-8">
          Depoimentos reais, dados anonimizados conforme LGPD para proteger a privacidade dos pacientes.
        </p>
      </div>
    </section>
  )
}
