import { useState } from 'react'
import { useLocation } from 'wouter'

const faqs = [
  { q: 'Como funciona a transcrição de áudio?', a: 'O médico inicia a consulta e a IA transcreve a conversa em tempo real. Ao final, gera automaticamente o SOAP estruturado nos campos S, O, A e P — pronto para o prontuário.' },
  { q: 'Os dados dos pacientes ficam seguros?', a: 'Sim. Todos os dados são criptografados em repouso e em trânsito. Seguimos rigorosamente a LGPD e as normas do CFM para prontuários digitais.' },
  { q: 'Funciona com qualquer especialidade médica?', a: 'Sim. A IA reconhece terminologia de todas as especialidades — Clínica Geral, Infectologia, Cardiologia, Pediatria, Psiquiatria e muito mais.' },
  { q: 'Quanto tempo leva para a clínica começar a usar?', a: 'Menos de 24 horas. Criamos os acessos, treinamos a equipe remotamente e a clínica já opera no mesmo dia.' },
  { q: 'Tem integração com prontuário eletrônico?', a: 'Oferecemos exportação em formato padrão e integração via API com os principais sistemas de prontuário eletrônico.' },
  { q: 'O que diferencia a MedScrita de outros sistemas?', a: 'Foi construída por médicos para médicos. Zero atrito: o médico fala, o sistema documenta. Sem formulários, sem digitação forçada, sem mudança de fluxo.' },
]

const testimonials = [
  { name: 'Dr. Carlos Oliveira', role: 'Cardiologista', clinic: 'Clínica do Coração — SP', text: 'Reduzi de 45 para 5 minutos a documentação por consulta. Consigo atender mais pacientes sem abrir mão da qualidade do prontuário.', stars: 5 },
  { name: 'Dra. Ana Costa', role: 'Infectologista', clinic: 'Centro Médico Saúde+ — RJ', text: 'A qualidade dos SOAPs gerados é impressionante. O sistema entende o contexto clínico com uma precisão que eu não esperava de nenhuma IA.', stars: 5 },
  { name: 'Dr. Rodrigo Lima', role: 'Clínico Geral', clinic: 'UBS Vila Nova — MG', text: 'Implementação simples, suporte rápido e resultado imediato. A melhor decisão que tomei para a gestão do consultório este ano.', stars: 5 },
  { name: 'Dra. Beatriz Santos', role: 'Pediatra', clinic: 'Pediátrica Bem Estar — RS', text: 'O painel administrativo me dá visão completa da clínica em tempo real. Consigo acompanhar a produção de todos os médicos.', stars: 5 },
  { name: 'Dr. Fernando Alves', role: 'Ortopedista', clinic: 'Instituto Movimento — DF', text: 'A base de conhecimento é fantástica. Toda consulta gera tópicos automáticos que a equipe estuda depois. Isso eleva o nível da clínica.', stars: 5 },
  { name: 'Dra. Juliana Matos', role: 'Psiquiatra', clinic: 'Clínica Mente Sã — BA', text: 'Finalmente um sistema que entende que cada especialidade tem vocabulário e fluxo próprio. Sinto que foi feito especificamente para mim.', stars: 5 },
]

const specialties = ['Cardiologia', 'Infectologia', 'Pediatria', 'Ortopedia', 'Psiquiatria', 'Ginecologia', 'Neurologia', 'Oncologia', 'Dermatologia', 'Endocrinologia', 'Clínica Geral', 'Geriatria']

const features = [
  {
    icon: '🎙️',
    title: 'Transcrição em Tempo Real',
    desc: 'Áudio da consulta transcrito automaticamente com reconhecimento de terminologia médica especializada.',
  },
  {
    icon: '📋',
    title: 'SOAP Automático',
    desc: 'Geração inteligente de prontuário estruturado nos campos S, O, A e P ao fim de cada consulta.',
  },
  {
    icon: '🧠',
    title: 'Base de Conhecimento',
    desc: 'Tópicos clínicos extraídos de cada consulta e organizados automaticamente para estudo da equipe.',
  },
  {
    icon: '📊',
    title: 'Dashboard Administrativo',
    desc: 'Visão completa da clínica: produção por médico, diagnósticos frequentes e indicadores clínicos.',
  },
]

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default function Landing() {
  const [, setLocation] = useLocation()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">MedScrita</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm text-slate-500">
            <a href="#sobre" className="hover:text-teal-700 transition-colors">Sobre</a>
            <a href="#funcionalidades" className="hover:text-teal-700 transition-colors">Funcionalidades</a>
            <a href="#depoimentos" className="hover:text-teal-700 transition-colors">Depoimentos</a>
            <a href="#faq" className="hover:text-teal-700 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation('/login')}
              className="text-sm text-slate-600 hover:text-teal-700 transition-colors hidden sm:block"
            >
              Entrar
            </button>
            <button
              onClick={() => setLocation('/login')}
              className="bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              Agendar Demo
            </button>
          </div>
        </div>
      </nav>

      {/* Gradient bar */}
      <div className="h-0.5 bg-gradient-to-r from-teal-400 via-cyan-400 via-emerald-400 to-teal-600" />

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left */}
          <div>
            <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              Sem contrato. Só resultado.
            </span>

            <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
              IA que<br />
              documenta.<br />
              <span className="text-teal-700">Médico que</span><br />
              <span className="text-teal-700">cuida.</span>
            </h1>

            <p className="text-slate-500 text-lg mb-8 leading-relaxed max-w-md">
              A MedScrita transcreve sua consulta e gera o SOAP automaticamente. Você fala. O sistema escreve.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-12">
              <button
                onClick={() => setLocation('/login')}
                className="bg-teal-700 hover:bg-teal-800 text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Agendar demonstração gratuita
              </button>
              <button
                onClick={() => setLocation('/login')}
                className="border border-slate-200 text-slate-700 hover:border-teal-300 hover:text-teal-700 font-medium px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Já tenho conta →
              </button>
            </div>

            {/* Quote card */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-lg max-w-sm">
              <p className="text-slate-700 text-sm leading-relaxed mb-4 italic">
                "Economizo 40 minutos por dia em documentação. Esse tempo voltou para os meus pacientes."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-sm">
                  CO
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Dr. Carlos Oliveira</p>
                  <p className="text-xs text-slate-400">Cardiologista · Clínica do Coração</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — stats cards */}
          <div className="relative flex flex-col gap-4">

            {/* Main stat */}
            <div className="bg-slate-900 text-white rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-teal-700/20 rounded-full -translate-y-8 translate-x-8" />
              <p className="text-5xl font-bold mb-1">1.200<span className="text-teal-400">+</span></p>
              <p className="text-slate-400 text-sm">Consultas documentadas por IA por mês</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-teal-50 rounded-2xl p-6">
                <p className="text-3xl font-bold text-teal-700 mb-1">40<span className="text-lg">min</span></p>
                <p className="text-slate-500 text-xs leading-relaxed">economizadas por médico por dia</p>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <p className="text-3xl font-bold text-slate-900 mb-1">98<span className="text-lg text-teal-600">%</span></p>
                <p className="text-slate-500 text-xs leading-relaxed">de satisfação entre os médicos usuários</p>
              </div>
            </div>

            {/* Rating */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
              <div className="flex -space-x-2">
                {['CO', 'AC', 'RL', 'BS', 'FA'].map((init) => (
                  <div key={init} className="w-8 h-8 rounded-full bg-teal-700 border-2 border-white flex items-center justify-center text-white text-xs font-bold">
                    {init[0]}
                  </div>
                ))}
              </div>
              <div>
                <Stars count={5} />
                <p className="text-xs text-slate-400 mt-0.5">Aprovado por médicos de todo o Brasil</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Full-width visual ──────────────────────────────────── */}
      <section className="mx-4 lg:mx-12 my-8 rounded-3xl overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-700 h-72 lg:h-96 flex items-center justify-center relative">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="text-center text-white px-8 relative z-10">
          <p className="text-4xl lg:text-5xl font-bold mb-4 leading-tight">
            Tecnologia que<br />respeita o tempo médico.
          </p>
          <p className="text-teal-200 text-lg">O prontuário pronto antes do próximo paciente entrar.</p>
        </div>
      </section>

      {/* ── Specialties marquee ───────────────────────────────── */}
      <section className="py-10 border-y border-slate-100 overflow-hidden">
        <div className="flex gap-8 animate-[marquee_20s_linear_infinite]" style={{ width: 'max-content' }}>
          {[...specialties, ...specialties].map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-slate-400 text-sm font-medium whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              {s}
            </div>
          ))}
        </div>
      </section>

      {/* ── About ─────────────────────────────────────────────── */}
      <section id="sobre" className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-teal-600 text-sm font-medium uppercase tracking-wider mb-4">Sobre a MedScrita</p>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              A maioria dos sistemas força o médico a{' '}
              <span className="text-slate-400">adaptar seu fluxo.</span>
            </h2>
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900 leading-snug mb-6">
              A MedScrita adapta o sistema ao médico.
            </p>
            <p className="text-slate-500 leading-relaxed mb-6">
              Nossa abordagem une inteligência artificial com os princípios reais da consulta médica. O resultado é um prontuário preciso, rápido e sem atrito — gerado enquanto você se concentra no que mais importa: o paciente.
            </p>
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-slate-300 text-sm">©2025 MedScrita</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section id="funcionalidades" className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-teal-600 text-sm font-medium uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2 className="text-4xl font-bold text-slate-900">Tudo que sua clínica precisa</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto">em uma plataforma integrada, simples de usar e pronta em 24 horas.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-teal-200 hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-2xl mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <section id="depoimentos" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <p className="text-teal-600 text-sm font-medium uppercase tracking-wider mb-3">Depoimentos</p>
          <h2 className="text-4xl font-bold text-slate-900">O que os médicos dizem</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`rounded-2xl p-6 border ${i === 1 ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-100'}`}
            >
              <div className="text-3xl mb-4 opacity-40">"</div>
              <p className={`text-sm leading-relaxed mb-6 ${i === 1 ? 'text-teal-100' : 'text-slate-600'}`}>
                {t.text}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${i === 1 ? 'bg-teal-600 text-white' : 'bg-teal-50 text-teal-700'}`}>
                    {t.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${i === 1 ? 'text-white' : 'text-slate-800'}`}>{t.name}</p>
                    <p className={`text-xs ${i === 1 ? 'text-teal-300' : 'text-slate-400'}`}>{t.role} · {t.clinic}</p>
                  </div>
                </div>
                <Stars count={t.stars} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <section id="faq" className="bg-slate-50 py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-teal-600 text-sm font-medium uppercase tracking-wider mb-3">FAQ</p>
            <h2 className="text-4xl font-bold text-slate-900">As dúvidas mais comuns</h2>
            <p className="text-slate-500 mt-4">de clínicas que estão avaliando a MedScrita.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-6 py-5 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-slate-800 text-sm">{faq.q}</span>
                  <span className={`text-teal-600 text-lg transition-transform duration-200 ${openFaq === i ? 'rotate-45' : ''}`}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Still have questions */}
          <div className="mt-10 bg-teal-700 rounded-2xl p-6 flex items-center justify-between">
            <p className="text-white font-medium text-sm">Ainda tem dúvidas?</p>
            <button
              onClick={() => setLocation('/login')}
              className="bg-white text-teal-700 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-teal-50 transition-colors"
            >
              Fale Conosco
            </button>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-teal-600 text-sm font-medium uppercase tracking-wider mb-4">Comece hoje</p>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
              Os melhores prontuários não pedem que o médico se adapte.
            </h2>
          </div>
          <div>
            <p className="text-slate-500 text-lg leading-relaxed mb-8">
              Fale com a gente. Mostramos como a MedScrita funciona na prática, com casos da sua especialidade, em menos de 30 minutos.
            </p>
            <button
              onClick={() => setLocation('/login')}
              className="bg-teal-700 hover:bg-teal-800 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-sm inline-block"
            >
              Agendar demonstração gratuita →
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">M</span>
                </div>
                <span className="font-bold text-lg">MedScrita</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Documentação clínica inteligente que ajuda médicos a focar no que realmente importa.
              </p>
            </div>

            {/* Menu */}
            <div>
              <p className="text-slate-300 font-semibold text-sm mb-4 uppercase tracking-wider">Menu</p>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><a href="#sobre" className="hover:text-teal-400 transition-colors">Sobre</a></li>
                <li><a href="#funcionalidades" className="hover:text-teal-400 transition-colors">Funcionalidades</a></li>
                <li><a href="#depoimentos" className="hover:text-teal-400 transition-colors">Depoimentos</a></li>
                <li><a href="#faq" className="hover:text-teal-400 transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-slate-300 font-semibold text-sm mb-4 uppercase tracking-wider">Legal</p>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li><span className="hover:text-teal-400 cursor-pointer transition-colors">Privacidade</span></li>
                <li><span className="hover:text-teal-400 cursor-pointer transition-colors">Termos de Uso</span></li>
                <li><span className="hover:text-teal-400 cursor-pointer transition-colors">LGPD</span></li>
                <li><span className="hover:text-teal-400 cursor-pointer transition-colors">CFM Compliance</span></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-slate-300 font-semibold text-sm mb-4 uppercase tracking-wider">Contato</p>
              <p className="text-teal-400 font-semibold text-sm mb-2">contato@medscrita.com.br</p>
              <p className="text-slate-500 text-xs leading-relaxed">
                Segunda a sexta<br />8h às 18h (horário de Brasília)
              </p>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-xs">©2025 MedScrita. Todos os direitos reservados.</p>
            <p className="text-slate-600 text-xs">Feito com cuidado para médicos brasileiros.</p>
          </div>
        </div>
      </footer>

      {/* Marquee keyframe */}
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
