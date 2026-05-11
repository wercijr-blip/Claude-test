import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Termos e condições de uso do Facilita PrEP — plataforma de teleconsulta para PrEP.',
  robots: { index: true, follow: true },
}

export default function TermosPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 font-body text-slate-800">
      <Link href="/" className="text-sm text-fp-accent hover:underline mb-6 inline-block">
        ← Voltar ao início
      </Link>

      <h1 className="text-3xl font-display font-semibold text-fp-dark mb-2">
        Termos de Uso
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Última atualização: {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <section className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">1. Aceitação</h2>
          <p>
            Ao acessar ou utilizar a plataforma <strong>Facilita PrEP</strong>, você concorda com estes Termos de Uso.
            Se não concordar com alguma condição, não utilize o serviço.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">2. Serviço</h2>
          <p>
            O Facilita PrEP é uma plataforma de <strong>telemedicina</strong> que facilita o acesso à
            Profilaxia Pré-Exposição ao HIV (PrEP) mediante consulta médica online com médico habilitado.
            O serviço inclui:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Formulário clínico digital</li>
            <li>Upload e análise de exames laboratoriais</li>
            <li>Consulta com infectologista (Dr. Werciley Saraiva Vieira Junior — CRM-DF 16381)</li>
            <li>Emissão de receita médica digital com assinatura ICP-Brasil</li>
            <li>Nota fiscal eletrônica (NFS-e)</li>
          </ul>
          <p className="mt-3 text-slate-500 text-xs">
            Conforme Resolução CFM nº 2.299/2021, nº 2.314/2022 e Lei nº 14.510/2022 (Telemedicina).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">3. Elegibilidade</h2>
          <p>Para utilizar o serviço, você deve:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Ter 18 anos ou mais (ou contar com autorização do responsável legal)</li>
            <li>Fornecer informações verídicas e atualizadas</li>
            <li>Ser residente no Brasil</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">4. Responsabilidades do paciente</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Fornecer informações clínicas completas e verdadeiras</li>
            <li>Enviar exames válidos e legíveis</li>
            <li>Informar ao médico sobre uso de outros medicamentos ou condições de saúde relevantes</li>
            <li>Seguir as orientações médicas prescritas</li>
            <li>Não compartilhar credenciais de acesso com terceiros</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">5. Limitações do serviço</h2>
          <p>O Facilita PrEP <strong>não</strong> é um serviço de emergência. Em caso de emergência médica,
          ligue para o SAMU (192) ou Bombeiros (193). A plataforma não substitui consultas presenciais
          quando clinicamente indicadas.</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">6. Pagamentos e reembolso</h2>
          <p>
            O valor da consulta é informado no momento do cadastro. Pagamentos são processados via Stripe
            (cartão de crédito/débito). Em caso de cancelamento antes do atendimento médico, entre em contato
            com nossa equipe em{' '}
            <a href="mailto:contato@facilitaprep.com.br" className="text-fp-accent hover:underline">
              contato@facilitaprep.com.br
            </a>{' '}
            para verificar elegibilidade a reembolso.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">7. Propriedade intelectual</h2>
          <p>
            Todo o conteúdo da plataforma (textos, design, código, marcas) é de propriedade da
            Saraiva e Dornelas Hospital Dia LTDA ou de seus licenciadores. É proibida a reprodução
            ou uso sem autorização expressa.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">8. Privacidade e LGPD</h2>
          <p>
            O tratamento de dados pessoais é regido pela nossa{' '}
            <Link href="/privacidade" className="text-fp-accent hover:underline">
              Política de Privacidade
            </Link>
            , em conformidade com a LGPD (Lei nº 13.709/2018).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">9. Alterações nos termos</h2>
          <p>
            Podemos atualizar estes termos a qualquer momento. Notificaremos mudanças significativas com
            pelo menos 30 dias de antecedência por e-mail. O uso contínuo após a vigência implica aceitação.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">10. Lei aplicável e foro</h2>
          <p>
            Estes termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de Brasília/DF
            para dirimir quaisquer controvérsias.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">11. Contato</h2>
          <p>
            Dúvidas sobre os termos:{' '}
            <a href="mailto:contato@facilitaprep.com.br" className="text-fp-accent hover:underline">
              contato@facilitaprep.com.br
            </a>
            <br />
            DPO / LGPD:{' '}
            <a href="mailto:dpo@facilitaprep.com.br" className="text-fp-accent hover:underline">
              dpo@facilitaprep.com.br
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}
