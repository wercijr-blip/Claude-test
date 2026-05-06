import { Link } from 'wouter'
import FooterCfm from './FooterCfm.tsx'

const LAST_UPDATED = '6 de maio de 2025'

export default function TermosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 text-slate-800">
        <Link href="/" className="text-sm text-fp-accent hover:underline mb-6 inline-block">
          ← Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold text-fp-dark mb-2">Termos de Uso</h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: {LAST_UPDATED}</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">1. Aceitação</h2>
            <p>
              Ao acessar ou utilizar a plataforma <strong>Facilita PrEP</strong>, você concorda com estes
              Termos de Uso e com nossa{' '}
              <Link href="/privacidade" className="text-fp-accent hover:underline">Política de Privacidade</Link>.
              Se não concordar, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">2. Descrição do serviço</h2>
            <p>O Facilita PrEP é uma plataforma de <strong>telemedicina</strong> que facilita o acesso à Profilaxia Pré-Exposição ao HIV (PrEP), incluindo:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Formulário clínico digital e upload de exames.</li>
              <li>Consulta com infectologista (Dr. Werciley Saraiva Vieira Júnior — CRM/DF 16381, RQE 14486).</li>
              <li>Emissão de receita médica digital com assinatura ICP-Brasil.</li>
              <li>Nota fiscal eletrônica (NFS-e).</li>
            </ul>
            <p className="mt-2 text-slate-500 text-xs">
              Conforme Resolução CFM nº 2.299/2021, nº 2.314/2022 e Lei nº 14.510/2022 (Telemedicina).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">3. Elegibilidade</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Ter 18 anos ou mais (ou autorização do responsável legal).</li>
              <li>Fornecer informações verídicas e atualizadas.</li>
              <li>Ser residente no Brasil.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">4. Responsabilidades do paciente</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fornecer informações clínicas completas e verdadeiras.</li>
              <li>Enviar exames válidos, legíveis e recentes (conforme orientação médica).</li>
              <li>Informar sobre uso de outros medicamentos e condições de saúde relevantes.</li>
              <li>Não compartilhar credenciais de acesso com terceiros.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">5. Limitações do serviço</h2>
            <p>
              O Facilita PrEP <strong>não é um serviço de emergência</strong>. Em caso de emergência médica,
              ligue para o SAMU (192) ou Bombeiros (193). A plataforma não substitui consultas presenciais
              quando clinicamente indicadas pelo médico.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">6. Pagamentos e reembolso</h2>
            <p>
              O valor da consulta é informado no momento do cadastro. Pagamentos são processados via
              Stripe (cartão de crédito/débito). Para cancelamentos antes do atendimento médico, entre
              em contato com{' '}
              <a href="mailto:contato@facilitaprep.com.br" className="text-fp-accent hover:underline">
                contato@facilitaprep.com.br
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">7. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo da plataforma (textos, design, código, marcas) é de propriedade da
              Saraiva e Dornelas Hospital Dia LTDA ou de seus licenciadores. É proibida a reprodução
              sem autorização expressa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">8. Alterações nos termos</h2>
            <p>
              Podemos atualizar estes termos. Mudanças significativas serão comunicadas por e-mail
              com pelo menos 30 dias de antecedência. O uso contínuo após a vigência implica aceitação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">9. Lei aplicável e foro</h2>
            <p>
              Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de
              Brasília/DF para dirimir quaisquer controvérsias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">10. Contato</h2>
            <p>
              Geral:{' '}
              <a href="mailto:contato@facilitaprep.com.br" className="text-fp-accent hover:underline">
                contato@facilitaprep.com.br
              </a><br />
              DPO / LGPD:{' '}
              <a href="mailto:dpo@facilitaprep.com.br" className="text-fp-accent hover:underline">
                dpo@facilitaprep.com.br
              </a>
            </p>
          </section>
        </div>
      </main>
      <FooterCfm />
    </div>
  )
}
