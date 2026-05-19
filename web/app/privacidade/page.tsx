import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como o Facilita PrEP coleta, usa e protege seus dados pessoais, em conformidade com a LGPD (Lei nº 13.709/2018).",
  robots: { index: true, follow: true },
};

export default function PoliticaPrivacidadePage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 font-body text-slate-800">
      <Link
        href="/"
        className="text-sm text-fp-accent hover:underline mb-6 inline-block"
      >
        ← Voltar ao início
      </Link>

      <h1 className="text-3xl font-display font-semibold text-fp-dark mb-2">
        Política de Privacidade
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Última atualização:{" "}
        {new Date().toLocaleDateString("pt-BR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <section className="prose prose-slate max-w-none space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            1. Quem somos
          </h2>
          <p>
            O <strong>Facilita PrEP</strong> é operado pela{" "}
            <strong>Saraiva e Dornelas Hospital Dia LTDA</strong>
            (CNPJ 61.983.778/0001-52), denominada nesta política como
            &quot;Controladora&quot;, com endereço na SHLS Quadra 716, Conjunto
            A, Consultórios 607 e 609, Asa Sul — Brasília/DF.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            2. Dados coletados
          </h2>
          <p>
            Coletamos apenas os dados necessários para prestação do serviço
            médico:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Identificação:</strong> nome, CPF, data de nascimento,
              nome da mãe, CNS
            </li>
            <li>
              <strong>Contato:</strong> e-mail, telefone, endereço
            </li>
            <li>
              <strong>Dados clínicos:</strong> informações preenchidas nos
              formulários de conduta e prescrição
            </li>
            <li>
              <strong>Exames:</strong> arquivos de exames laboratoriais enviados
              para análise
            </li>
            <li>
              <strong>Técnicos:</strong> endereço IP, agente de navegador (para
              segurança e auditoria)
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            3. Finalidade e base legal (LGPD)
          </h2>
          <table className="w-full text-xs border-collapse border border-slate-200 mt-2">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 px-3 py-2 text-left">
                  Finalidade
                </th>
                <th className="border border-slate-200 px-3 py-2 text-left">
                  Base legal (LGPD)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 px-3 py-2">
                  Prestação do serviço médico / prontuário
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  Art. 7º, III — execução de contrato; Art. 11, II, f — tutela
                  da saúde
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2">
                  Emissão de receita digital (ICP-Brasil)
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  Art. 7º, II — obrigação legal (CFM 2.299/2021)
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2">
                  Comunicações sobre seu atendimento
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  Art. 7º, III — execução de contrato
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2">
                  Segurança e prevenção de fraudes
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  Art. 7º, IX — legítimo interesse
                </td>
              </tr>
              <tr>
                <td className="border border-slate-200 px-3 py-2">
                  Cumprimento de obrigação legal (retenção de prontuário)
                </td>
                <td className="border border-slate-200 px-3 py-2">
                  Art. 7º, II — Lei 13.787/2018 + CFM 2.299/2021
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            4. Proteção dos dados
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              CPF, nome, data de nascimento e dados de contato são{" "}
              <strong>criptografados em repouso</strong> (AES-256-GCM)
            </li>
            <li>Transmissão via HTTPS/TLS 1.3</li>
            <li>
              Acesso restrito por autenticação Google OAuth + controle de perfis
              de acesso
            </li>
            <li>
              Logs de auditoria imutáveis para rastreamento de todos os acessos
              a dados pessoais
            </li>
            <li>
              Rate limiting e monitoramento de segurança em tempo real (Sentry)
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            5. Retenção
          </h2>
          <p>
            Prontuários médicos são retidos por{" "}
            <strong>mínimo de 20 anos</strong> após o último atendimento,
            conforme exigido pela Lei 13.787/2018 e Resolução CFM 2.299/2021.
            Dados não essenciais podem ser anonimizados a seu pedido respeitando
            este prazo.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            6. Compartilhamento
          </h2>
          <p>
            Seus dados <strong>não são vendidos ou compartilhados</strong> com
            terceiros para fins comerciais. Compartilhamos apenas com:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>AWS S3</strong> — armazenamento seguro de exames e
              documentos
            </li>
            <li>
              <strong>TiDB Cloud (PingCAP)</strong> — banco de dados gerenciado,
              hospedado em Frankfurt (Alemanha, UE)
            </li>
            <li>
              <strong>FocusNFe</strong> — emissão de nota fiscal de serviço
              (NFS-e)
            </li>
            <li>
              <strong>Asaas</strong> — processamento de pagamentos
            </li>
            <li>Autoridades competentes quando exigido por lei</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            7. Seus direitos (LGPD Art. 18)
          </h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Acesso:</strong> exportar todos os seus dados pessoais
            </li>
            <li>
              <strong>Retificação:</strong> corrigir dados incorretos ou
              incompletos
            </li>
            <li>
              <strong>Anonimização:</strong> solicitar remoção de dados
              desnecessários (respeitando retenção legal)
            </li>
            <li>
              <strong>Portabilidade:</strong> receber seus dados em formato
              estruturado
            </li>
            <li>
              <strong>Informação:</strong> saber com quem seus dados foram
              compartilhados
            </li>
            <li>
              <strong>Revogação de consentimento:</strong> quando o tratamento
              for baseado em consentimento
            </li>
          </ul>
          <p className="mt-3">
            Para exercer seus direitos, acesse sua conta no portal do paciente
            ou entre em contato com nosso DPO pelo e-mail{" "}
            <a
              href="mailto:dpo@facilitaprep.com.br"
              className="text-fp-accent hover:underline"
            >
              dpo@facilitaprep.com.br
            </a>
            . Respondemos em até 15 dias úteis.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            8. Encarregado (DPO)
          </h2>
          <p>
            Nosso Encarregado de Proteção de Dados (DPO) pode ser contatado em:{" "}
            <a
              href="mailto:dpo@facilitaprep.com.br"
              className="text-fp-accent hover:underline"
            >
              dpo@facilitaprep.com.br
            </a>
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            9. Cookies e rastreamento
          </h2>
          <p>
            Utilizamos cookies funcionais e, com seu consentimento, cookies de
            análise (Google Analytics 4) e publicidade (Meta Pixel, Google Ads,
            TikTok). Você pode gerenciar suas preferências pelo banner de
            cookies exibido ao acessar o site.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            10. Alterações
          </h2>
          <p>
            Esta política pode ser atualizada periodicamente. Notificaremos
            mudanças significativas por e-mail ou por aviso no portal. A data de
            última atualização está indicada no topo desta página.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            11. Transferência internacional de dados
          </h2>
          <p>
            Alguns dados pessoais e dados de saúde são processados em servidores
            localizados fora do Brasil. Especificamente:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>União Europeia — Frankfurt, Alemanha:</strong> banco de
              dados principal no provedor TiDB Cloud (PingCAP), operado na
              região <code>eu-central-1</code> da AWS. Sujeito ao GDPR e com
              certificação ISO 27001.
            </li>
            <li>
              <strong>Estados Unidos:</strong> Sentry (monitoramento de erros e
              rastreamento de desempenho), AWS S3 (armazenamento de exames e
              documentos).
            </li>
          </ul>
          <p className="mt-3">
            As transferências ocorrem com base no Art. 33, II (&quot;execução de
            contrato&quot;) e Art. 33, IV (&quot;salvaguardas adequadas&quot;)
            da LGPD. Os provedores adotam cláusulas contratuais padrão e
            certificações reconhecidas internacionalmente para proteção de
            dados.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-fp-dark mb-2">
            12. Contato e reclamações
          </h2>
          <p>
            Em caso de dúvidas ou reclamações, você pode contatar nosso DPO ou
            registrar uma queixa na Autoridade Nacional de Proteção de Dados
            (ANPD) em{" "}
            <a
              href="https://www.gov.br/anpd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fp-accent hover:underline"
            >
              www.gov.br/anpd
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
