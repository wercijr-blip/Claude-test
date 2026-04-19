import { useState } from 'react'
import { Logo } from './Logo.tsx'

const FAQS = [
  {
    q: 'O Facilita PrEP substitui uma consulta médica convencional?',
    a: 'Não. O Facilita PrEP é uma plataforma digital de saúde — não uma consulta médica convencional. Nosso objetivo é democratizar o acesso à PrEP: facilitar a solicitação dos exames de investigação de IST, avaliar os resultados de forma ágil, orientar sobre a PrEP e emitir a prescrição digital para quem tem indicação. Caso algum exame apresente resultado positivo para IST ou HIV, a plataforma orienta e encaminha você a consultar seu médico de confiança ou um serviço especializado.',
  },
  {
    q: 'A PrEP é sigilosa? Alguém vai saber que estou usando?',
    a: 'Sim, totalmente sigilosa. Seus dados são protegidos pela LGPD (Lei nº 13.709/2018) e pelo sigilo médico. O diagnóstico e o uso da PrEP não são informados a planos de saúde, empregadores ou familiares sem sua autorização. Os documentos gerados ficam disponíveis apenas para você e para a equipe médica responsável.',
  },
  {
    q: 'Quanto tempo leva desde o cadastro até receber a receita?',
    a: 'Para atendimento particular: normalmente menos de 24 horas. Você faz o cadastro, paga, envia ou realiza os exames, preenche o formulário clínico e recebe os documentos assinados digitalmente por e-mail no mesmo dia. Para plano de saúde, o prazo pode ser maior, pois depende da validação da cobertura.',
  },
  {
    q: 'Quais exames preciso fazer antes de começar a PrEP?',
    a: 'Os exames obrigatórios são: Anti-HIV 1/2 com Ag p24 (4ª geração), Creatinina sérica (função renal), VDRL (sífilis), HBsAg e Anti-HBc (Hepatite B), Anti-HCV (Hepatite C). Dependendo do perfil clínico, pode ser solicitado também PCR para gonorreia e clamídia, e densitometria óssea para monitoramento de longo prazo. O Facilita PrEP gera os pedidos de exames assinados digitalmente caso você ainda não os tenha.',
  },
  {
    q: 'A PrEP protege contra outras ISTs além do HIV?',
    a: 'Não. A PrEP protege especificamente contra o HIV. Ela não previne sífilis, gonorreia, clamídia, herpes ou hepatites. Por isso, o uso de preservativo continua sendo recomendado em conjunto com a PrEP para proteção ampla. O acompanhamento regular inclui triagem periódica para essas infecções.',
  },
  {
    q: 'Posso fazer PrEP pelo SUS?',
    a: 'Sim. A PrEP está disponível no SUS desde 2017 para pessoas em situação de risco aumentado para o HIV. Basta comparecer a um Serviço de Atenção Especializada (SAE) ou Unidade Dispensadora de Medicamentos (UDM) com exames recentes. O Facilita PrEP é uma opção para quem prefere comodidade, rapidez e atendimento digital particular ou via plano de saúde.',
  },
  {
    q: 'Preciso tomar a PrEP todo dia? E se esquecer um dia?',
    a: 'Sim, a PrEP diária (TDF/FTC) deve ser tomada todos os dias no mesmo horário para manter a eficácia máxima acima de 99%. Se esquecer um comprimido, tome assim que lembrar — mas nunca tome dois comprimidos de uma vez. Esquecer doses ocasionais reduz a proteção. Existe também a PrEP sob demanda (2-1-1), indicada para homens que fazem sexo com homens de forma não diária — seu médico pode orientar sobre qual modalidade é mais adequada para o seu perfil.',
  },
  {
    q: 'A PrEP tem efeitos colaterais?',
    a: 'A maioria das pessoas tolera muito bem. Os efeitos mais comuns nas primeiras semanas são leves: náusea, dor de cabeça e desconforto gastrointestinal — que geralmente desaparecem em 2 a 4 semanas. Em casos raros pode haver alteração da função renal ou da densidade óssea, por isso o acompanhamento periódico com exames é essencial. Informe seu médico sobre qualquer medicamento que estiver usando.',
  },
  {
    q: 'Posso usar PrEP se já sou HIV positivo?',
    a: 'Não. A PrEP é indicada apenas para pessoas HIV negativas. Se você já tem HIV, o tratamento adequado é a TARV (Terapia Antirretroviral). Um dos exames realizados antes de iniciar a PrEP é justamente o teste de HIV para confirmar que você é negativo. Em caso de resultado positivo, você será orientado e encaminhado ao serviço de saúde especializado adequado.',
  },
  {
    q: 'Meus dados ficam seguros na plataforma?',
    a: 'Sim. O Facilita PrEP utiliza criptografia AES para armazenar CPF, nome e dados de contato. Os exames e documentos ficam em servidores com criptografia em repouso. Cumprimos integralmente a LGPD, com retenção de dados clínicos por 20 anos conforme a Resolução CFM nº 2.218/2018. Nenhum dado é compartilhado com terceiros sem sua autorização.',
  },
  {
    q: 'Como funciona a assinatura digital nos documentos?',
    a: 'Todos os documentos gerados pelo Facilita PrEP (receita, formulário clínico, pedidos de exame) são assinados com certificado digital ICP-Brasil, padrão exigido pelo CFM (Resolução nº 2.299/2021). Isso garante validade jurídica equivalente à assinatura física, com carimbo de tempo e identificação do médico responsável. Você pode verificar a autenticidade de qualquer documento nos validadores do ITI.',
  },
  {
    q: 'Meu plano de saúde cobre a PrEP?',
    a: 'Depende do plano. Pelo Rol de Procedimentos da ANS, os planos de saúde são obrigados a cobrir consultas médicas e exames laboratoriais. A cobertura do medicamento em si (TDF/FTC) pode variar. O Facilita PrEP aceita os principais planos — nossa equipe verifica a cobertura após o cadastro e informa você antes de qualquer cobrança.',
  },
  {
    q: 'O que levar para retirar minha PrEP na rede pública (UDM)?',
    a: 'Se for sua primeira retirada, leve: Ficha de Cadastro, Receita Médica, Formulário PrEP e o resultado do exame Anti-HIV realizado há menos de 7 dias. Todos esses documentos são gerados pelo Facilita PrEP com assinatura digital ICP-Brasil. Se já usa PrEP regularmente, leve: Receita Médica, Formulário PrEP e o resultado do exame Anti-HIV com menos de 7 dias — também gerados pela plataforma. Localize a UDM mais próxima em azt.aids.gov.br → "Consulte uma UDM".',
  },
  {
    q: 'Por que recebo pedidos de exames de IST, HIV e densitometria óssea?',
    a: 'Os pedidos de exame fazem parte do protocolo de acompanhamento seguro da PrEP. O exame de HIV é obrigatório antes de cada renovação (resultado com menos de 7 dias). Os exames de IST (sífilis, hepatite, gonorreia, clamídia) devem ser realizados a cada 3 meses — ou sempre que houver suspeita de infecção sexual, pois a PrEP não protege contra essas infecções. A densitometria óssea deve ser feita anualmente: o Tenofovir (TDF), componente da PrEP oral, pode reduzir a densidade mineral óssea em uso prolongado, aumentando o risco de osteoporose. O monitoramento garante que qualquer alteração seja identificada e tratada precocemente.',
  },
]

const PASSOS = [
  { num: '1', titulo: 'Cadastro', desc: 'Informe nome, CPF, e-mail e telefone. Escolha entre atendimento particular ou pelo plano de saúde.' },
  { num: '2', titulo: 'Pagamento ou validação do plano', desc: 'Particular: pagamento via PIX, cartão de crédito ou débito. Plano: nossa equipe verifica a cobertura (seg.–sex., 8h–18h).' },
  { num: '3', titulo: 'Acesso ao formulário', desc: 'Você recebe um link exclusivo por e-mail. Clique para acessar a triagem clínica de forma segura.' },
  { num: '4', titulo: 'Triagem e exames', desc: 'Informe se possui exames recentes de HIV. Se não tiver, geramos os pedidos assinados digitalmente para você levar ao laboratório.' },
  { num: '5', titulo: 'Formulário clínico', desc: 'Preencha seu histórico de saúde em etapas simples. Campos como nome e CPF já vêm pré-preenchidos do cadastro.' },
  { num: '6', titulo: 'TCLE e assinatura', desc: 'Leia e assine o Termo de Consentimento Livre e Esclarecido digitalmente — com validade jurídica.' },
  { num: '7', titulo: 'Documentos prontos', desc: 'Receba por e-mail a receita, o formulário clínico e a ficha de cadastro — todos assinados com certificado ICP-Brasil.' },
]

function Accordion({ items }: { items: typeof FAQS }) {
  const [open, setOpen] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 bg-white hover:bg-slate-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-medium text-slate-800 leading-snug">{item.q}</span>
            <svg
              className={`w-5 h-5 text-slate-400 shrink-0 mt-0.5 transition-transform ${open === i ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === i && (
            <div className="px-5 pb-4 bg-white border-t border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed pt-3">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function DuvidasPage() {
  return (
    <div className="bg-warm-bg min-h-screen">

      {/* Hero */}
      <div className="bg-gradient-to-br from-fp-dark via-fp-dark-mid to-fp-dark-soft text-white px-4 py-16 text-center">
        <div className="flex justify-center mb-6">
          <Logo size={120} mode="dark" />
        </div>
        <p className="font-display text-fp-lilac-soft text-base italic mb-1" style={{ letterSpacing: '0.05em' }}>facilita</p>
        <p className="text-fp-dark-soft text-[10px] font-bold mb-6" style={{ letterSpacing: '0.3em' }}>PrEP</p>
        <h1 className="font-display text-4xl sm:text-5xl font-light mb-4 leading-tight">Tire suas dúvidas sobre PrEP</h1>
        <p className="text-fp-lavender-100 text-base max-w-xl mx-auto leading-relaxed">
          Tudo o que você precisa saber sobre a Profilaxia Pré-Exposição ao HIV e sobre como funciona o Facilita PrEP.
        </p>
        <a href="/" className="inline-block mt-8 bg-white text-fp-accent font-semibold px-7 py-3 rounded-full hover:bg-fp-lavender-50 transition-colors text-sm shadow-md">
          Quero me cadastrar →
        </a>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">

        {/* O que é o Facilita PrEP */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-2">O que é o Facilita PrEP?</h2>
          <p className="text-sm text-slate-500 mb-6">Uma plataforma digital de saúde — não uma consulta médica convencional.</p>
          <div className="bg-white rounded-2xl border border-brand-light p-6 space-y-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              O <strong>Facilita PrEP</strong> é uma <strong>plataforma digital de saúde</strong> criada para
              democratizar e facilitar o acesso da população à PrEP — tanto pela rede pública quanto de forma particular.
              Não se trata de uma consulta médica convencional, mas de um serviço estruturado e regulamentado
              para guiar você com agilidade, sigilo e segurança em cada etapa do processo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { emoji: '🔬', titulo: 'Acesso fácil aos exames', desc: 'Geramos os pedidos de exames de investigação de IST com assinatura digital ICP-Brasil.' },
                { emoji: '⚡', titulo: 'Avaliação rápida dos exames', desc: 'Seus resultados são avaliados de forma ágil pela equipe médica responsável.' },
                { emoji: '📋', titulo: 'Orientação sobre a PrEP', desc: 'Informações claras e baseadas em evidências para você tomar a melhor decisão.' },
                { emoji: '💊', titulo: 'Prescrição digital', desc: 'Receita assinada digitalmente com certificado ICP-Brasil, com validade jurídica em todo o Brasil.' },
              ].map(({ emoji, titulo, desc }) => (
                <div key={titulo} className="flex items-start gap-3 bg-brand-pale rounded-xl p-4">
                  <span className="text-2xl shrink-0">{emoji}</span>
                  <div>
                    <p className="font-semibold text-brand-dark text-sm">{titulo}</p>
                    <p className="text-xs text-brand mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-terra-light border border-terra-light rounded-xl p-4 mt-2">
              <p className="text-xs text-terra-dark leading-relaxed">
                <strong>⚠️ Atenção:</strong> caso algum resultado de exame se mostre positivo para IST ou HIV,
                a plataforma <strong>não substitui o acompanhamento clínico especializado</strong>.
                Nessa situação, você será orientado a agendar uma consulta com seu médico de confiança
                ou com um serviço de saúde especializado.
              </p>
            </div>
          </div>
        </section>

        {/* O que é PrEP */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-6">O que é a PrEP?</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-sm text-slate-700 leading-relaxed">
            <p>
              <strong>PrEP</strong> significa <strong>Profilaxia Pré-Exposição</strong>. É um medicamento antirretroviral
              — geralmente a combinação <strong>Tenofovir + Emtricitabina (TDF/FTC)</strong> — tomado por pessoas
              HIV negativas antes de se exporem ao vírus, com o objetivo de <strong>prevenir a infecção pelo HIV</strong>.
            </p>
            <p>
              Quando tomada corretamente e todos os dias, a PrEP reduz o risco de contrair o HIV por relações
              sexuais em <strong>mais de 99%</strong>. Em usuários de drogas injetáveis, a redução chega a 74%.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {[
                { emoji: '💊', titulo: 'Medicamento oral', desc: '1 comprimido por dia, no mesmo horário' },
                { emoji: '🛡️', titulo: '>99% de eficácia', desc: 'Quando tomado corretamente e de forma contínua' },
                { emoji: '🔬', titulo: 'Aprovado pela ANVISA', desc: 'Disponível pelo SUS desde 2017 e em farmácias e drogarias na modalidade particular' },
              ].map(({ emoji, titulo, desc }) => (
                <div key={titulo} className="bg-brand-pale rounded-xl p-4 text-center">
                  <div className="text-3xl mb-2">{emoji}</div>
                  <p className="font-semibold text-brand-dark text-sm">{titulo}</p>
                  <p className="text-xs text-brand mt-1">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-honey-light rounded-2xl border border-honey-light p-5 mt-4 space-y-3">
            <p className="text-sm font-semibold text-honey-dark">
              Como retirar sua PrEP com os documentos do Facilita PrEP
            </p>
            <p className="text-xs text-honey-dark leading-relaxed">
              Com os documentos emitidos pela plataforma — todos com assinatura digital ICP-Brasil — você tem <strong>duas opções</strong> para receber a medicação:
            </p>
            <ul className="space-y-2 text-xs text-honey-dark leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-honey font-bold mt-0.5">🏥</span>
                <span>
                  <strong>Pela rede pública (SUS):</strong> leve o formulário PrEP, a receita e o exame de HIV (&lt; 7 dias) à UDM mais próxima e retire o TDF/FTC.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-honey font-bold mt-0.5">💊</span>
                <span>
                  <strong>Em farmácias e drogarias (particular):</strong> apresente a receita digital em qualquer farmácia ou drogaria do Brasil para comprar o medicamento.
                </span>
              </li>
            </ul>
            <p className="text-xs text-honey leading-relaxed italic">
              Você escolhe a opção que melhor se encaixa em sua rotina — sem precisar começar de novo.
            </p>
          </div>

          {/* PrEP injetável */}
          <div className="bg-white rounded-2xl border border-brand-light p-6 mt-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-2xl">💉</span>
              <h3 className="font-bold text-slate-800">Novidade: PrEP subcutânea (injetável)</h3>
              <span className="ml-auto text-xs bg-brand-light text-brand-dark font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">Em breve no Facilita PrEP</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Além do comprimido diário, já existe uma opção injetável de longa duração:
              o <strong>Cabotegravir injetável (CAB-LA)</strong>. Aprovado pela ANVISA, é aplicado
              a cada <strong>2 meses</strong> por um profissional de saúde e demonstrou eficácia
              <strong> superior à PrEP oral</strong> em estudos clínicos — tornando-se ideal para
              quem tem dificuldade em tomar comprimidos diariamente.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { emoji: '📅', titulo: 'A cada 2 meses', desc: 'Uma injeção subcutânea aplicada pela equipe de saúde' },
                { emoji: '⚡', titulo: 'Alta eficácia', desc: 'Estudos mostram proteção superior ao comprimido diário' },
                { emoji: '✅', titulo: 'Aprovado pela ANVISA', desc: 'Registrado no Brasil; disponível em clínicas particulares' },
              ].map(({ emoji, titulo, desc }) => (
                <div key={titulo} className="bg-brand-pale rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{emoji}</div>
                  <p className="font-semibold text-brand-dark text-xs">{titulo}</p>
                  <p className="text-xs text-brand mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-brand-pale border border-brand-light rounded-xl p-3">
              <p className="text-xs text-brand-dark leading-relaxed">
                🚀 <strong>Em breve disponível pelo Facilita PrEP:</strong> agendamento da PrEP injetável com prescrição digital e acompanhamento pela nossa plataforma. Faça seu cadastro para ser notificado quando disponível.
              </p>
            </div>
          </div>
        </section>

        {/* Quem pode tomar */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-6">Quem tem indicação para usar PrEP?</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              A PrEP é indicada para pessoas HIV negativas com risco aumentado de infecção. Não há restrição por sexo, gênero ou orientação sexual. Os principais grupos com indicação são:
            </p>
            <div className="space-y-3">
              {[
                { emoji: '👥', texto: 'Homens que fazem sexo com homens (HSH) e pessoas trans com vida sexual ativa' },
                { emoji: '💑', texto: 'Casais sorodiscordantes — quando um parceiro vive com HIV e o outro não' },
                { emoji: '🔄', texto: 'Pessoas com múltiplos parceiros sexuais sem uso consistente de preservativo' },
                { emoji: '💉', texto: 'Usuários de drogas injetáveis que compartilham agulhas ou seringas' },
                { emoji: '👩‍⚕️', texto: 'Profissionais do sexo e suas redes de parceiros' },
                { emoji: '🩺', texto: 'Qualquer pessoa com histórico recente de IST (sífilis, gonorreia, clamídia)' },
              ].map(({ emoji, texto }) => (
                <div key={texto} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="text-xl shrink-0">{emoji}</span>
                  <p className="leading-snug pt-0.5">{texto}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 bg-honey-light border border-honey-light rounded-xl p-4">
              <p className="text-xs text-honey-dark leading-relaxed">
                <strong>Importante:</strong> a indicação final é sempre do médico, após avaliação clínica e exames.
                O Facilita PrEP conecta você a um médico especializado de forma rápida e sigilosa.
              </p>
            </div>
          </div>
        </section>

        {/* Como funciona o Facilita PrEP */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-2">Como funciona o Facilita PrEP?</h2>
          <p className="text-sm text-slate-500 mb-6">Do cadastro à receita assinada digitalmente, tudo online.</p>
          <div className="space-y-3">
            {PASSOS.map((p) => (
              <div key={p.num} className="bg-white rounded-2xl border border-slate-200 p-5 flex gap-4 items-start">
                <div className="w-9 h-9 rounded-full bg-brand text-white text-sm font-bold flex items-center justify-center shrink-0">
                  {p.num}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{p.titulo}</p>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SUS vs Particular */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-6">PrEP no SUS × PrEP particular</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <p className="font-bold text-slate-800 mb-3">🏥 SUS</p>
              <ul className="text-xs text-slate-600 space-y-2">
                <li>✓ Medicamento fornecido pelo SUS</li>
                <li>✓ Exames periódicos pelo SUS</li>
                <li>✗ Necessário comparecer presencialmente ao SAE/UDM</li>
                <li>✗ Fila de espera em algumas cidades</li>
                <li>✗ Horários limitados</li>
                <li>✗ Possível exposição em ambiente de saúde pública</li>
              </ul>
            </div>
            <div className="bg-brand-pale rounded-2xl border border-brand-light p-5">
              <p className="font-bold text-brand-dark mb-3">💻 Facilita PrEP (particular / plano)</p>
              <ul className="text-xs text-brand-dark space-y-2">
                <li>✓ Atendimento 100% online e ágil</li>
                <li>✓ Receita assinada digitalmente em horas</li>
                <li>✓ Total sigilo e privacidade</li>
                <li>✓ Pedidos de exame gerados na plataforma</li>
                <li>✓ Documentos com validade jurídica ICP-Brasil</li>
                <li>✓ Aceita os principais planos de saúde</li>
              </ul>
            </div>
          </div>

          {/* SUS UDM Locator */}
          <div className="mt-4 bg-sage-pale rounded-2xl border border-sage-light p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🗺️</span>
              <h3 className="font-bold text-sage-dark text-sm">Como encontrar a UDM mais próxima de você</h3>
            </div>
            <p className="text-xs text-sage-dark leading-relaxed mb-4">
              As <strong>Unidades Dispensadoras de Medicamentos (UDMs)</strong> são os postos do SUS onde você retira a PrEP. Para localizar a unidade mais próxima:
            </p>
            <ol className="text-xs text-sage-dark space-y-2 mb-4">
              <li className="flex items-start gap-2">
                <span className="bg-sage-light text-sage-dark font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs">1</span>
                <span>Acesse o site oficial do Departamento de HIV, Hepatites Virais e IST</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-sage-light text-sage-dark font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs">2</span>
                <span>Clique em <strong>"Consulte uma UDM"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="bg-sage-light text-sage-dark font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs">3</span>
                <span>Escolha o seu <strong>estado</strong> para ver as unidades disponíveis</span>
              </li>
            </ol>
            <a
              href="https://azt.aids.gov.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-sage text-white text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-sage-dark transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Acessar azt.aids.gov.br → Consulte uma UDM
            </a>
          </div>

          {/* O que levar à UDM */}
          <div className="mt-4 bg-white rounded-2xl border border-slate-200 p-5">
            <p className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span className="text-lg">📋</span>
              O que levar para retirar sua PrEP na rede pública
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-brand-pale rounded-xl p-4">
                <p className="text-xs font-bold text-brand-dark mb-3">🆕 Primeira retirada</p>
                <ul className="space-y-1.5">
                  {[
                    'Ficha de Cadastro',
                    'Receita Médica',
                    'Formulário PrEP',
                    'Exame Anti-HIV (menos de 7 dias)',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-brand-dark">
                      <svg className="w-3.5 h-3.5 text-brand shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-brand mt-3 italic">Todos gerados pelo Facilita PrEP.</p>
              </div>
              <div className="bg-sage-pale rounded-xl p-4">
                <p className="text-xs font-bold text-sage-dark mb-3">🔄 Já uso PrEP regularmente</p>
                <ul className="space-y-1.5">
                  {[
                    'Receita Médica',
                    'Formulário PrEP',
                    'Exame Anti-HIV (menos de 7 dias)',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-1.5 text-xs text-sage-dark">
                      <svg className="w-3.5 h-3.5 text-sage shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-sage mt-3 italic">Todos gerados pelo Facilita PrEP.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Por que recebo pedidos de exames */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-2">Por que recebo pedidos de exames de IST, HIV e densitometria?</h2>
          <p className="text-sm text-slate-500 mb-6">O acompanhamento laboratorial é parte essencial do protocolo seguro da PrEP.</p>
          <div className="space-y-4">
            {[
              {
                icone: '🔴',
                cor: 'border-terra-light bg-terra-light',
                corTitulo: 'text-terra-dark',
                corTexto: 'text-terra',
                titulo: 'Exame de HIV — obrigatório a cada renovação',
                desc: 'O resultado deve ter sido realizado há menos de 7 dias. O diagnóstico prévio de HIV contraindicaria a PrEP — por isso a confirmação periódica é indispensável e protege você.',
              },
              {
                icone: '🟡',
                cor: 'border-honey-light bg-honey-light',
                corTitulo: 'text-honey-dark',
                corTexto: 'text-honey',
                titulo: 'Exames de IST — a cada 3 meses (ou ao menor sinal de infecção)',
                desc: 'A PrEP protege contra o HIV, mas não contra sífilis, gonorreia, clamídia ou hepatites. O rastreamento trimestral — ou sempre que houver suspeita — garante diagnóstico e tratamento precoce. Por isso o Facilita PrEP sempre gera as requisições de sorológicos junto com a prescrição.',
              },
              {
                icone: '🦴',
                cor: 'border-brand-light bg-brand-pale',
                corTitulo: 'text-brand-dark',
                corTexto: 'text-brand-dark',
                titulo: 'Densitometria óssea — anualmente',
                desc: 'O Tenofovir (TDF), componente da PrEP oral, pode reduzir a densidade mineral óssea em uso prolongado, aumentando o risco de osteoporose. O exame anual de densitometria detecta alterações precocemente, permitindo ajuste de conduta ou suplementação antes que haja impacto clínico significativo.',
              },
            ].map(({ icone, cor, corTitulo, corTexto, titulo, desc }) => (
              <div key={titulo} className={`rounded-2xl border ${cor} p-5`}>
                <p className={`font-bold text-sm mb-2 ${corTitulo}`}>{icone} {titulo}</p>
                <p className={`text-xs leading-relaxed ${corTexto}`}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="font-display text-3xl font-light text-fp-dark mb-2">Perguntas frequentes</h2>
          <p className="text-sm text-slate-500 mb-6">Clique em uma pergunta para ver a resposta.</p>
          <Accordion items={FAQS} />
        </section>

        {/* CTA final */}
        <section className="bg-brand-dark rounded-2xl p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">Pronto para começar?</h2>
          <p className="text-blue-100 text-sm mb-6 leading-relaxed">
            Cadastre-se agora e receba sua receita de PrEP com assinatura digital ICP-Brasil em poucas horas.
          </p>
          <a
            href="/"
            className="inline-block bg-white text-brand font-bold px-8 py-3 rounded-xl hover:bg-brand-pale transition-colors"
          >
            Fazer cadastro →
          </a>
        </section>

      </div>
    </div>
  )
}
