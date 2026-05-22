'use client'

import { useState, useEffect, useRef } from 'react'
import { LogoWordmark } from './Logo'
import IntakePage from './IntakePage'
import { trackAgendarClick, trackWhatsApp } from '../lib/analytics'
import Counter from './landing/Counter'
import Benefits from './landing/Benefits'
import Testimonials from './landing/Testimonials'

type Tipo = 'particular' | 'plano'
type Variant = 'google' | 'meta' | 'retargeting'

const VARIANT_CONTENT: Record<Variant, {
  badge: string
  h1: string
  h1Accent: string
  sub: string
  cta: string
}> = {
  google: {
    badge: 'Resultado de busca — PrEP online',
    h1: 'Receita PrEP online hoje',
    h1Accent: 'sem fila, sem deslocamento',
    sub: 'Você já pesquisou — agora é só dar o próximo passo. Consulta com infectologista e receita com assinatura ICP-Brasil em até 24h.',
    cta: 'Quero minha PrEP agora →',
  },
  meta: {
    badge: '100% online · Discreta · Legal',
    h1: 'Saúde sexual preventiva',
    h1Accent: 'sem julgamentos, sem filas',
    sub: 'Proteja-se com PrEP de forma moderna, sigilosa e 100% online. Receita digital com validade legal em todo o Brasil.',
    cta: 'Começar minha proteção →',
  },
  retargeting: {
    badge: 'Você nos conhece — hora de agir',
    h1: 'Sua proteção está',
    h1Accent: 'esperando por você',
    sub: 'Você já conhece a Facilita PrEP. A consulta é rápida, o processo simples e sua receita fica pronta em até 24h.',
    cta: 'Iniciar agora por R$ 150 →',
  },
}

function scrollTop() {
  if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' })
}

export default function LandingPage({ variant }: { variant?: Variant }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState<Tipo | undefined>(undefined)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [showSticky, setShowSticky] = useState(false)
  const heroRef = useRef<HTMLElement>(null)

  const vc = variant ? VARIANT_CONTENT[variant] : null

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0 }
    )
    if (heroRef.current) observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [])

  function openForm(tipo?: Tipo, local = 'generic') {
    trackAgendarClick(local)
    setSelectedTipo(tipo)
    setShowForm(true)
    scrollTop()
  }

  if (showForm) {
    return <IntakePage initialTipo={selectedTipo} autoStart={!!selectedTipo} />
  }

  return (
    <div className="min-h-screen bg-fp-fog font-body">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-fp-lavender-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <LogoWordmark size={36} mode="light" />
          <div className="flex items-center gap-3">
            <a
              href="https://blog.facilitaprep.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block text-sm text-fp-dark-soft hover:text-fp-accent transition-colors font-medium"
            >
              Blog
            </a>
            <a
              href="/duvidas"
              className="hidden sm:block text-sm text-fp-dark-soft hover:text-fp-accent transition-colors font-medium"
            >
              Dúvidas
            </a>
            <button
              onClick={() => openForm(undefined, 'navbar')}
              className="bg-fp-accent text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-fp-dark-mid transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              Começar agora
            </button>
          </div>
        </div>
      </nav>

      {/* ── Sticky CTA bar ─────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 bg-fp-dark/95 backdrop-blur-md border-b border-white/10 transition-all duration-300 ${
          showSticky ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <p className="text-white/80 text-sm font-medium hidden sm:block">
            Consulta PrEP online · Receita ICP-Brasil em até 24h
          </p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => openForm('plano', 'sticky_plano')}
              className="text-white/60 text-sm font-medium hover:text-white transition-colors"
            >
              Tenho plano
            </button>
            <button
              onClick={() => openForm('particular', 'sticky_particular')}
              className="bg-fp-lilac text-fp-dark px-5 py-2 rounded-full text-sm font-bold hover:bg-fp-lilac-soft transition-all active:scale-95"
            >
              Começar por R$ 150 →
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden bg-gradient-to-br from-fp-dark via-fp-dark-mid to-fp-dark-soft pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-fp-lilac opacity-10 blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-fp-blue opacity-10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

            {/* Left column */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 rounded-full bg-fp-success animate-pulse" />
                <span className="text-white/80 text-xs font-medium">
                  {vc ? vc.badge : '100% online · Receita em até 24 h'}
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] mb-5">
                {vc ? vc.h1 : 'PrEP com receita'}<br />
                <span className="text-fp-lilac-soft">{vc ? vc.h1Accent : 'digital e sigilosa'}</span>
              </h1>

              <p className="text-white/70 text-lg sm:text-xl leading-relaxed mb-8 max-w-lg">
                {vc
                  ? vc.sub
                  : 'Consulta médica, análise de exames e receita com assinatura ICP-Brasil — sem sair de casa, sem exposição desnecessária.'}
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={() => openForm('particular', 'hero_primary')}
                  data-event="cta_hero"
                  data-event-label="hero_particular"
                  className="bg-fp-lilac text-fp-dark px-8 py-4 rounded-2xl text-base font-bold hover:bg-fp-lilac-soft transition-all shadow-lg active:scale-95"
                >
                  {vc ? vc.cta : 'Quero minha PrEP agora →'}
                </button>
                <a
                  href="/duvidas"
                  className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-6 py-4 rounded-2xl text-base font-medium hover:bg-white/20 transition-all"
                >
                  O que é PrEP?
                </a>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {['#B890D0', '#88AACE', '#7DBFA0', '#D4A86A'].map((c, i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-fp-dark-mid"
                      style={{ background: c, opacity: 0.9 }}
                    />
                  ))}
                </div>
                <p className="text-white/60 text-sm">
                  <span className="text-white font-semibold">+2.000 pacientes</span> já protegidos
                </p>
              </div>
            </div>

            {/* Right column — floating card (desktop) */}
            <div className="hidden lg:flex justify-end items-center">
              <div className="relative">
                <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 w-80 shadow-2xl">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-fp-lilac/30 flex items-center justify-center">
                      <svg className="w-5 h-5 text-fp-lilac-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Receita digital</p>
                      <p className="text-white/50 text-xs">Assinatura ICP-Brasil</p>
                    </div>
                    <div className="ml-auto w-2 h-2 rounded-full bg-fp-success animate-pulse" />
                  </div>
                  <div className="space-y-2.5">
                    {['Consulta médica', 'Análise de exames', 'Receita gerada', 'Enviada ao paciente'].map((label) => (
                      <div key={label} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-fp-success/30 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-fp-success" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-white/80 text-sm">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <p className="text-white/50 text-xs">Dr. Werciley Saraiva · CRM/DF 16381</p>
                    <p className="text-fp-lilac-soft text-xs mt-0.5 font-medium">Concluído em 18 min</p>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-8 bg-white rounded-2xl p-3 shadow-xl border border-fp-lavender-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-fp-lavender-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-fp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-fp-dark text-xs font-bold">Sigilo total</p>
                      <p className="text-fp-dark-soft text-[10px]">LGPD · Dados criptografados</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile — mini trust strip below CTA */}
            <div className="lg:hidden flex flex-wrap gap-2 -mt-4">
              {['🔒 Sigiloso', '✅ ICP-Brasil', '⚡ Até 24h'].map((t) => (
                <span key={t} className="bg-white/10 border border-white/20 text-white/70 text-xs px-3 py-1.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>

          </div>
        </div>
      </section>

      <Counter />

      {/* ── Como funciona ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Processo</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark">Simples em 3 passos</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                step: '01',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
                title: 'Preencha o formulário',
                desc: 'Dados clínicos básicos e upload dos seus exames (HIV, creatinina, etc.) de forma segura e sigilosa.',
              },
              {
                step: '02',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                ),
                title: 'Médico revisa',
                desc: 'Nosso infectologista analisa seu caso, avalia os exames e, se indicado, prescreve a PrEP.',
              },
              {
                step: '03',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Receba a receita',
                desc: 'Receita com assinatura digital ICP-Brasil enviada por e-mail e WhatsApp. Válida em qualquer farmácia.',
              },
            ].map((item, i) => (
              <div key={i} className="relative bg-white rounded-3xl p-7 border border-fp-lavender-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="absolute top-6 right-6 font-display text-6xl text-fp-lavender-100 font-semibold leading-none select-none">
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-fp-lavender-50 flex items-center justify-center text-fp-accent mb-5">
                  {item.icon}
                </div>
                <h3 className="font-semibold text-fp-dark text-lg mb-2">{item.title}</h3>
                <p className="text-fp-dark-soft text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => openForm('particular', 'como_funciona')}
              className="inline-flex items-center gap-2 bg-fp-accent text-white px-8 py-3.5 rounded-2xl text-sm font-semibold hover:bg-fp-dark-mid transition-all shadow-sm active:scale-95"
            >
              Começar agora →
            </button>
          </div>
        </div>
      </section>

      <Benefits />

      {/* ── Médico ─────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Quem cuida de você</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark">Médico infectologista especializado</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — doctor card */}
            <div className="bg-white rounded-3xl border border-fp-lavender-100 shadow-sm p-8">
              <div className="flex items-start gap-6 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-fp-lavender-50 to-fp-lavender-100 flex items-center justify-center shrink-0">
                  <svg className="w-10 h-10 text-fp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-display text-2xl text-fp-dark leading-tight">Dr. Werciley Saraiva<br />Vieira Junior</h3>
                  <p className="text-fp-accent font-semibold text-sm mt-1">Médico Infectologista</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-fp-lavender-50 text-fp-accent text-xs font-medium px-2.5 py-1 rounded-full">CRM/DF 16381</span>
                    <span className="bg-fp-lavender-50 text-fp-accent text-xs font-medium px-2.5 py-1 rounded-full">RQE 14486</span>
                  </div>
                </div>
              </div>

              <p className="text-fp-dark-soft text-sm leading-relaxed mb-6">
                Especialista em Infectologia com atuação em prevenção do HIV, saúde sexual e medicina de viagem.
                Membro da Sociedade Brasileira de Infectologia, com ampla experiência no acompanhamento de
                pacientes em uso de PrEP e no manejo clínico de ISTs.
              </p>

              <div className="border-t border-fp-lavender-100 pt-5">
                <p className="text-xs text-fp-dark-soft font-medium mb-3 uppercase tracking-wider">Credenciais e compliance</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'CFM', sub: 'Telemedicina regulamentada', icon: '⚕️' },
                    { label: 'ICP-Brasil', sub: 'Receita com validade legal', icon: '✅' },
                    { label: 'LGPD', sub: 'Dados criptografados', icon: '🔒' },
                  ].map((item) => (
                    <div key={item.label} className="bg-fp-fog rounded-xl p-3 text-center">
                      <span className="text-xl block mb-1">{item.icon}</span>
                      <p className="font-bold text-fp-dark text-xs">{item.label}</p>
                      <p className="text-fp-dark-soft text-[10px] leading-tight mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — trust highlights */}
            <div className="space-y-5">
              {[
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  ),
                  title: 'Especialista em PrEP',
                  desc: 'Protocolo atualizado conforme PCDT/Ministério da Saúde e diretrizes internacionais da OMS e CDC.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  ),
                  title: 'Telemedicina com respaldo legal',
                  desc: 'Atendimento regulamentado pela Resolução CFM 2.299/2021 e 2.314/2022. Receita com assinatura ICP-Brasil aceita em todo o Brasil.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  ),
                  title: 'Suporte pós-consulta',
                  desc: 'Acompanhamento contínuo via WhatsApp para dúvidas após o atendimento, sem custo adicional.',
                },
                {
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                  title: 'Resposta em até 24 horas',
                  desc: 'Análise clínica, avaliação de exames e emissão da receita dentro de 24 horas úteis após o envio do formulário.',
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 bg-white rounded-2xl p-5 border border-fp-lavender-100">
                  <div className="w-10 h-10 rounded-xl bg-fp-lavender-50 flex items-center justify-center text-fp-accent shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-fp-dark text-sm mb-1">{item.title}</h4>
                    <p className="text-fp-dark-soft text-xs leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparativo ────────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Comparativo</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark mb-4">Por que não o SUS ou clínica?</h2>
            <p className="text-fp-dark-soft text-lg max-w-xl mx-auto">
              Cada caminho tem suas vantagens. Veja onde a Facilita PrEP se diferencia.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left text-fp-dark-soft font-medium py-3 pr-4 w-36 sm:w-48" />
                  <th className="py-3 px-3 sm:px-4 rounded-t-2xl bg-fp-dark text-white font-semibold text-center">
                    <span className="block text-xs text-fp-lilac-soft uppercase tracking-wider mb-0.5">Recomendado</span>
                    Facilita PrEP
                  </th>
                  <th className="py-3 px-3 sm:px-4 text-fp-dark font-medium text-center">SUS / UBS</th>
                  <th className="py-3 px-3 sm:px-4 text-fp-dark font-medium text-center">Clínica presencial</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: 'Prazo para receita',
                    fp: '< 24 horas',
                    sus: 'Semanas a meses',
                    clinica: '2–5 dias úteis',
                    fpBold: true,
                  },
                  {
                    label: 'Sigilo garantido',
                    fp: '✅ Total',
                    sus: '⚠️ Moderado',
                    clinica: '⚠️ Moderado',
                    fpBold: false,
                  },
                  {
                    label: 'Disponibilidade',
                    fp: 'Todo o Brasil',
                    sus: 'Municípios selecionados',
                    clinica: 'Grandes centros',
                    fpBold: true,
                  },
                  {
                    label: 'Sem deslocamento',
                    fp: '✅ 100% online',
                    sus: '❌ Presencial',
                    clinica: '❌ Presencial',
                    fpBold: false,
                  },
                  {
                    label: 'Custo',
                    fp: 'R$ 150',
                    sus: 'Gratuito*',
                    clinica: 'R$ 300–600',
                    fpBold: false,
                  },
                  {
                    label: 'Receita ICP-Brasil',
                    fp: '✅ Digital válida',
                    sus: 'Receita física',
                    clinica: 'Receita física',
                    fpBold: false,
                  },
                ].map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-fp-fog' : 'bg-white'}>
                    <td className="py-3.5 pr-4 font-medium text-fp-dark text-xs sm:text-sm">{row.label}</td>
                    <td className={`py-3.5 px-3 sm:px-4 text-center bg-fp-dark/5 ${row.fpBold ? 'text-fp-accent font-bold' : 'text-fp-dark font-medium'}`}>
                      {row.fp}
                    </td>
                    <td className="py-3.5 px-3 sm:px-4 text-center text-fp-dark-soft">{row.sus}</td>
                    <td className="py-3.5 px-3 sm:px-4 text-center text-fp-dark-soft">{row.clinica}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-fp-dark-soft text-xs mt-4 text-center">
            *SUS gratuito, mas com tempo de espera variável e cobertura geográfica limitada. Dados estimados.{' '}
            <a
              href="/duvidas#sus"
              data-event="click_sus_link"
              className="underline hover:text-fp-accent transition-colors"
            >
              Saiba mais sobre PrEP pelo SUS →
            </a>
          </p>

          <div className="text-center mt-8">
            <button
              onClick={() => openForm('particular', 'comparativo')}
              className="inline-flex items-center gap-2 bg-fp-accent text-white px-8 py-3.5 rounded-2xl text-sm font-semibold hover:bg-fp-dark-mid transition-all shadow-sm active:scale-95"
            >
              Iniciar minha consulta →
            </button>
          </div>
        </div>
      </section>

      <Testimonials />

      {/* ── Modalidades ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Modalidades</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark mb-4">Escolha seu acesso</h2>
            <p className="text-fp-dark-soft text-lg max-w-xl mx-auto">
              Disponível de forma particular ou para beneficiários de planos de saúde conveniados.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Particular */}
            <div className="bg-white rounded-3xl border-2 border-fp-lavender-100 hover:border-fp-accent p-8 shadow-sm hover:shadow-md transition-all group">
              <div className="w-10 h-10 rounded-xl bg-fp-lavender-50 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-fp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-fp-dark mb-1">Particular</h3>
              <p className="text-fp-dark-soft text-sm leading-relaxed mb-5">
                Pagamento único por PIX, cartão de crédito ou débito. Acesso liberado imediatamente após confirmação.
              </p>
              <div className="mb-5 pb-5 border-b border-fp-lavender-100">
                <div className="flex items-baseline gap-1">
                  <span className="text-fp-dark-soft text-sm">R$</span>
                  <span className="font-display text-4xl text-fp-accent font-semibold leading-none">150</span>
                  <span className="text-fp-dark-soft text-sm">,00</span>
                </div>
                <p className="text-fp-dark-soft text-xs mt-1">Pagamento único · sem mensalidades</p>
              </div>
              <ul className="space-y-2 mb-6">
                {['Consulta médica online', 'Análise dos seus exames', 'Receita ICP-Brasil', 'Acompanhamento pós-consulta'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-fp-dark">
                    <svg className="w-4 h-4 text-fp-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 mb-5 text-xs text-fp-dark-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />PIX
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Crédito
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />Débito
              </div>
              <button
                onClick={() => openForm('particular', 'preco_particular')}
                data-event="select_plan_particular"
                data-event-label="preco_particular"
                className="w-full bg-fp-accent text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-fp-dark-mid transition-colors active:scale-95"
              >
                Iniciar agora →
              </button>
            </div>

            {/* Plano */}
            <div className="bg-gradient-to-br from-fp-dark-mid to-fp-dark rounded-3xl border border-fp-dark p-8 shadow-lg relative overflow-hidden">
              <div className="absolute top-4 right-4">
                <span className="bg-fp-lilac text-fp-dark text-xs font-bold px-2.5 py-1 rounded-full">Convênio</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-fp-lilac-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-white mb-1">Plano de saúde</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-5">
                Para beneficiários de planos conveniados. Atendimento coberto pelo seu plano, com a mesma agilidade.
              </p>
              <ul className="space-y-2 mb-6">
                {['Cobertura pelo seu plano', 'Sem custo adicional*', 'Mesma agilidade e sigilo', 'Receita ICP-Brasil'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                    <svg className="w-4 h-4 text-fp-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-white/40 text-xs mb-5 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Atendimento seg.–sex., das 08h às 18h
              </p>
              <button
                onClick={() => openForm('plano', 'preco_plano')}
                data-event="select_plan_convenio"
                data-event-label="preco_plano"
                className="w-full bg-fp-lilac text-fp-dark py-3.5 rounded-2xl font-semibold text-sm hover:bg-fp-lilac-soft transition-colors active:scale-95"
              >
                Iniciar com plano →
              </button>
              <p className="text-white/30 text-[10px] mt-3 text-center">*Sujeito à cobertura do seu plano</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark">Perguntas frequentes</h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'O que é PrEP e para quem é indicada?',
                a: 'PrEP (Profilaxia Pré-Exposição) é um medicamento antiretroviral tomado por pessoas HIV-negativas para prevenir a infecção pelo HIV. É indicada para pessoas com risco aumentado de exposição, como parceiros sorodiscordantes ou pessoas com múltiplos parceiros.',
              },
              {
                q: 'Quais exames preciso ter para iniciar a PrEP?',
                a: 'São necessários: teste de HIV (negativo), função renal (creatinina), hepatite B e C, e opcionalmente ISTs. Se você não tiver exames recentes, nossa equipe pode orientar sobre como realizá-los.',
              },
              {
                q: 'A receita digital é aceita em qualquer farmácia?',
                a: 'Sim. A receita possui assinatura digital ICP-Brasil, que tem validade jurídica plena conforme a legislação brasileira, e é aceita em farmácias de todo o país, tanto para medicamento particular quanto pelo SUS.',
              },
              {
                q: 'Meus dados ficam protegidos?',
                a: 'Absolutamente. Todos os dados sensíveis (CPF, nome, histórico clínico) são criptografados em repouso. Seguimos rigorosamente a LGPD e os padrões de segurança de saúde do CFM.',
              },
              {
                q: 'Quanto tempo leva para receber a receita?',
                a: 'Após preencher o formulário e enviar os exames, o médico analisa em até 24 horas úteis e emite a receita. A maioria dos atendimentos é concluída no mesmo dia.',
              },
              {
                q: 'Preciso fazer consultas de acompanhamento?',
                a: 'Sim. O protocolo PrEP exige acompanhamento a cada 3 meses com renovação de exames. Nossa plataforma facilita todo esse processo de forma contínua e online.',
              },
            ].map((item, i) => (
              <div key={i} className="border border-fp-lavender-100 rounded-2xl overflow-hidden">
                <button
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-fp-fog transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-fp-dark text-sm sm:text-base">{item.q}</span>
                  <svg
                    className={`w-5 h-5 text-fp-accent shrink-0 transition-transform ${openFaq === i ? 'rotate-45' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-fp-dark-soft text-sm leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <a href="/duvidas" className="text-fp-accent text-sm font-medium hover:underline">
              Ver todas as dúvidas sobre PrEP →
            </a>
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-fp-dark-mid via-fp-dark to-fp-dark-soft py-20 sm:py-28">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-fp-lilac opacity-10 blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-fp-lilac-soft text-sm font-semibold uppercase tracking-widest mb-4">Comece hoje</p>
          <h2 className="font-display text-4xl sm:text-5xl text-white mb-5 leading-tight">
            Proteja-se com<br />
            <span className="text-fp-lilac-soft">praticidade e sigilo</span>
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            Junte-se aos +2.000 pacientes que já acessam a PrEP de forma rápida, segura e 100% online.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => openForm('particular', 'final_cta_particular')}
              data-event="cta_hero"
              data-event-label="final_cta_particular"
              className="inline-flex items-center justify-center gap-2 bg-fp-lilac text-fp-dark px-10 py-4 rounded-2xl text-base font-bold hover:bg-fp-lilac-soft transition-all shadow-xl active:scale-95"
            >
              Começar por R$ 150
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button
              onClick={() => openForm('plano', 'final_cta_plano')}
              className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white px-8 py-4 rounded-2xl text-base font-medium hover:bg-white/20 transition-all active:scale-95"
            >
              Tenho plano de saúde
            </button>
          </div>
          <p className="text-white/30 text-xs mt-6">
            Processo 100% digital · Receita com assinatura ICP-Brasil · LGPD compliant
          </p>
        </div>
      </section>

      {/* ── WhatsApp flutuante ─────────────────────────────────────────── */}
      <a
        href="https://wa.me/5561994018161?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20a%20PrEP%20pelo%20Facilita%20PrEP"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackWhatsApp('float_button')}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20c05a] rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        aria-label="Falar no WhatsApp"
      >
        <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </a>

    </div>
  )
}
