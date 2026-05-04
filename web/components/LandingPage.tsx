'use client'

import { useState } from 'react'
import { LogoWordmark } from './Logo'
import IntakePage from './IntakePage'

export default function LandingPage() {
  const [showForm, setShowForm] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  if (showForm) {
    return <IntakePage />
  }

  return (
    <div className="min-h-screen bg-fp-fog font-body">

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-fp-lavender-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <LogoWordmark size={36} mode="light" />
          <div className="flex items-center gap-3">
            <a
              href="/duvidas"
              className="hidden sm:block text-sm text-fp-dark-soft hover:text-fp-accent transition-colors font-medium"
            >
              Dúvidas
            </a>
            <button
              onClick={() => setShowForm(true)}
              className="bg-fp-accent text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-fp-dark-mid transition-all shadow-sm hover:shadow-md active:scale-95"
            >
              Começar agora
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-fp-dark via-fp-dark-mid to-fp-dark-soft pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* background blobs */}
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
                <span className="text-white/80 text-xs font-medium">100% online · Resultado em até 24 h</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1] mb-5">
                PrEP com receita<br />
                <span className="text-fp-lilac-soft">digital e sigilosa</span>
              </h1>

              <p className="text-white/70 text-lg sm:text-xl leading-relaxed mb-8 max-w-lg">
                Consulta médica, análise de exames e receita com assinatura
                ICP-Brasil — sem sair de casa, sem exposição desnecessária.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={() => setShowForm(true)}
                  className="bg-fp-lilac text-fp-dark px-8 py-4 rounded-2xl text-base font-bold hover:bg-fp-lilac-soft transition-all shadow-lg hover:shadow-fp-lilac/30 active:scale-95"
                >
                  Quero minha PrEP agora →
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

            {/* Right column — floating card */}
            <div className="hidden lg:flex justify-end items-center">
              <div className="relative">
                {/* main card */}
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
                    {[
                      { label: 'Consulta médica', done: true },
                      { label: 'Análise de exames', done: true },
                      { label: 'Receita gerada', done: true },
                      { label: 'Enviada ao paciente', done: true },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-fp-success/30 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-fp-success" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-white/80 text-sm">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <p className="text-white/50 text-xs">Dr. Werciley Saraiva · CRM/DF 16381</p>
                    <p className="text-fp-lilac-soft text-xs mt-0.5 font-medium">Concluído em 18 min</p>
                  </div>
                </div>

                {/* badge card */}
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

          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-fp-lavender-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {[
            { value: '99%', label: 'Eficácia na prevenção do HIV' },
            { value: '<24h', label: 'Receita emitida' },
            { value: '100%', label: 'Processo digital' },
            { value: 'ICP-Brasil', label: 'Assinatura legal' },
          ].map((s) => (
            <div key={s.value} className="text-center">
              <p className="font-display text-3xl text-fp-accent font-semibold">{s.value}</p>
              <p className="text-xs text-fp-dark-soft mt-1 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Como funciona ──────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Processo</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark">
              Simples em 3 passos
            </h2>
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
              <div
                key={i}
                className="relative bg-white rounded-3xl p-7 border border-fp-lavender-100 shadow-sm hover:shadow-md transition-shadow group"
              >
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
        </div>
      </section>

      {/* ── Benefícios ─────────────────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            <div>
              <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Por que Facilita PrEP</p>
              <h2 className="font-display text-4xl sm:text-5xl text-fp-dark mb-6 leading-tight">
                Sem filas.<br />Sem constrangimento.<br />Sem complicação.
              </h2>
              <p className="text-fp-dark-soft text-lg leading-relaxed mb-8">
                Acesso à PrEP ainda é um desafio em muitas regiões. A Facilita PrEP resolve isso com
                uma plataforma segura, discreta e legalmente reconhecida.
              </p>
              <ul className="space-y-4">
                {[
                  'Consulta e receita 100% online, sem exposição',
                  'Sigilo absoluto — LGPD, dados criptografados',
                  'Médico infectologista especializado',
                  'Receita com validade legal (ICP-Brasil)',
                  'Suporte pós-consulta via WhatsApp',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-fp-success/20 flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-fp-success" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-fp-dark text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: '🏥',
                  title: 'Telemedicina CFM',
                  desc: 'Regulamentada pelas resoluções CFM 2.299/2021 e 2.314/2022',
                },
                {
                  icon: '🔒',
                  title: 'Dados seguros',
                  desc: 'CPF e dados sensíveis criptografados conforme LGPD',
                },
                {
                  icon: '📋',
                  title: 'Receita válida',
                  desc: 'Assinatura ICP-Brasil, aceita em farmácias de todo o Brasil',
                },
                {
                  icon: '⚡',
                  title: 'Resultado rápido',
                  desc: 'Da consulta à receita em menos de 24 horas',
                },
                {
                  icon: '💊',
                  title: 'PrEP + acompanhamento',
                  desc: 'Protocolo de acompanhamento periódico conforme PCDT',
                },
                {
                  icon: '🤝',
                  title: 'Suporte humano',
                  desc: 'Equipe disponível para esclarecer dúvidas antes e após',
                },
              ].map((card) => (
                <div key={card.title} className="bg-fp-fog rounded-2xl p-5 border border-fp-lavender-100">
                  <span className="text-2xl mb-3 block">{card.icon}</span>
                  <h4 className="font-semibold text-fp-dark text-sm mb-1">{card.title}</h4>
                  <p className="text-fp-dark-soft text-xs leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Modalidades ────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-fp-accent text-sm font-semibold uppercase tracking-widest mb-2">Modalidades</p>
            <h2 className="font-display text-4xl sm:text-5xl text-fp-dark mb-4">
              Escolha seu acesso
            </h2>
            <p className="text-fp-dark-soft text-lg max-w-xl mx-auto">
              Disponível de forma particular ou para beneficiários de planos de saúde conveniados.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Particular */}
            <div className="bg-white rounded-3xl border border-fp-lavender-100 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-fp-lavender-50 flex items-center justify-center mb-5">
                <svg className="w-5 h-5 text-fp-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-display text-2xl text-fp-dark mb-2">Particular</h3>
              <p className="text-fp-dark-soft text-sm leading-relaxed mb-6">
                Acesso direto sem necessidade de plano. Pagamento único pela consulta e receita.
              </p>
              <ul className="space-y-2 mb-7">
                {['Consulta médica online', 'Análise dos seus exames', 'Receita ICP-Brasil', 'Acompanhamento pós-consulta'].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-fp-dark">
                      <svg className="w-4 h-4 text-fp-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  )
                )}
              </ul>
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-fp-accent text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-fp-dark-mid transition-colors"
              >
                Iniciar agora
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
              <h3 className="font-display text-2xl text-white mb-2">Plano de saúde</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                Para beneficiários de planos conveniados. Atendimento coberto pelo seu plano.
              </p>
              <ul className="space-y-2 mb-7">
                {['Cobertura pelo seu plano', 'Sem custo adicional*', 'Mesma agilidade e sigilo', 'Receita ICP-Brasil'].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                      <svg className="w-4 h-4 text-fp-success shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  )
                )}
              </ul>
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-fp-lilac text-fp-dark py-3.5 rounded-2xl font-semibold text-sm hover:bg-fp-lilac-soft transition-colors"
              >
                Iniciar agora
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
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
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
            Junte-se a milhares de pessoas que já acessam a PrEP de forma rápida, segura e 100% online.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-fp-lilac text-fp-dark px-10 py-4 rounded-2xl text-base font-bold hover:bg-fp-lilac-soft transition-all shadow-xl hover:shadow-fp-lilac/30 active:scale-95"
          >
            Quero minha PrEP agora
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </button>
          <p className="text-white/30 text-xs mt-5">
            Processo 100% digital · Receita com assinatura ICP-Brasil · LGPD compliant
          </p>
        </div>
      </section>

    </div>
  )
}
