import { Link } from 'wouter'
import FooterCfm from './FooterCfm.tsx'

const LAST_UPDATED = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-12 text-slate-800">
        <Link href="/" className="text-sm text-fp-accent hover:underline mb-6 inline-block">
          ← Voltar ao início
        </Link>

        <h1 className="text-3xl font-bold text-fp-dark mb-2">Política de Privacidade</h1>
        <p className="text-sm text-slate-500 mb-8">Última atualização: {LAST_UPDATED}</p>

        <div className="space-y-6 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">1. Quem somos (Controlador)</h2>
            <p>
              A Facilita PrEP é operada por <strong>Saraiva e Dornelas Hospital Dia LTDA</strong>,
              CNPJ 61.983.778/0001-52, nome fantasia <em>Iaso Saúde Hospital Dia</em>, com sede em
              SHLS Quadra 716, Conjunto A, Consultórios 607 e 609, 6º Andar, Asa Sul — Brasília/DF.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">2. Encarregado (DPO)</h2>
            <p>
              Dr. Werciley Saraiva Vieira Júnior (CRM/DF 16381 · RQE 14486 — Infectologia).<br />
              Contato: <a href="mailto:dpo@facilitaprep.com.br" className="text-fp-accent hover:underline">dpo@facilitaprep.com.br</a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">3. Dados coletados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Identificação:</strong> nome, CPF, data de nascimento, RG.</li>
              <li><strong>Contato:</strong> e-mail, telefone, endereço.</li>
              <li><strong>Saúde:</strong> histórico clínico, exames laboratoriais, prescrições, dados sobre PrEP e ISTs.</li>
              <li><strong>Pagamento:</strong> processado por terceiros (Stripe) — não armazenamos dados de cartão.</li>
              <li><strong>Técnicos:</strong> IP, navegador, sistema operacional, cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">4. Finalidades e base legal (LGPD)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Prestação do serviço médico em PrEP — Art. 7º, V + Art. 11, II, f (tutela da saúde).</li>
              <li>Emissão de prescrições digitais ICP-Brasil — Art. 7º, II (obrigação legal CFM 2.299/2021).</li>
              <li>Manutenção de prontuário eletrônico — Art. 7º, II (Lei 13.787/2018).</li>
              <li>Comunicação sobre sua consulta — Art. 7º, V.</li>
              <li>Cumprimento de obrigações fiscais (NFS-e) — Art. 7º, II.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">5. Compartilhamento com terceiros</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>TiDB Cloud (PingCAP)</strong> — banco de dados gerenciado, hospedado em Frankfurt (Alemanha, UE).</li>
              <li><strong>Asaas</strong> — processamento de pagamento e emissão de nota fiscal eletrônica (Brasil).</li>
              <li><strong>AWS S3</strong> — armazenamento criptografado de exames e documentos (EUA).</li>
              <li><strong>Z-API</strong> — envio de mensagens WhatsApp.</li>
              <li><strong>Resend</strong> — e-mails transacionais.</li>
              <li><strong>Sentry</strong> — monitoramento de erros, sem PII (EUA).</li>
              <li><strong>Cloudflare</strong> — CDN, segurança e e-mail.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">6. Retenção de dados</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Prontuário eletrônico:</strong> mínimo 20 anos (Lei 13.787/2018).</li>
              <li><strong>Notas fiscais:</strong> 5 anos (Receita Federal).</li>
              <li><strong>Logs de auditoria:</strong> 5 anos.</li>
              <li><strong>Dados cadastrais:</strong> enquanto a conta estiver ativa + 5 anos após exclusão.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">7. Seus direitos (Art. 18 LGPD)</h2>
            <p className="mb-2">Você pode, a qualquer momento:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Acessar e corrigir seus dados.</li>
              <li>Exportar seus dados em formato JSON (disponível no portal do paciente).</li>
              <li>Solicitar anonimização (respeitando retenção legal de 20 anos do prontuário).</li>
              <li>Revogar o consentimento.</li>
              <li>Apresentar reclamação à <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-fp-accent hover:underline">ANPD</a>.</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos: <a href="mailto:dpo@facilitaprep.com.br" className="text-fp-accent hover:underline">dpo@facilitaprep.com.br</a>.
              Resposta em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">8. Segurança</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Criptografia em trânsito (TLS 1.3) e em repouso (AES-256-GCM).</li>
              <li>Autenticação de dois fatores (2FA) obrigatória para profissionais de saúde.</li>
              <li>Logs de auditoria imutáveis para todo acesso a dados de paciente.</li>
              <li>Rate limiting e proteção contra ataques automatizados.</li>
              <li>Backups diários com retenção de 30 dias (TiDB Cloud + S3).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">9. Cookies</h2>
            <p>
              Usamos cookies essenciais (sessão, autenticação) e analíticos (Google Analytics 4 — com consentimento).
              Gerencie suas preferências pelo banner ao acessar o site pela primeira vez.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">10. Alterações desta política</h2>
            <p>
              Esta política pode ser atualizada periodicamente. Notificaremos mudanças significativas
              por e-mail ou aviso no portal. A data de última atualização está indicada no topo desta página.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">11. Transferência internacional de dados</h2>
            <p className="mb-2">
              Alguns dados pessoais e de saúde são processados em servidores fora do Brasil:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>União Europeia — Frankfurt, Alemanha:</strong> banco de dados principal no
                provedor TiDB Cloud (PingCAP), região <code className="text-xs bg-slate-100 px-1 rounded">eu-central-1</code> da AWS.
                Sujeito ao GDPR e com certificação ISO 27001.
              </li>
              <li>
                <strong>Estados Unidos:</strong> Sentry (monitoramento de erros),
                AWS S3 (armazenamento de exames e documentos).
              </li>
            </ul>
            <p className="mt-3 text-slate-600">
              As transferências ocorrem com base no Art. 33, II ("execução de contrato") e
              Art. 33, IV ("salvaguardas adequadas") da LGPD. Os provedores adotam cláusulas
              contratuais padrão e certificações reconhecidas internacionalmente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-fp-dark mb-2">12. Contato</h2>
            <p>
              DPO: <a href="mailto:dpo@facilitaprep.com.br" className="text-fp-accent hover:underline">dpo@facilitaprep.com.br</a><br />
              Geral: <a href="mailto:contato@facilitaprep.com.br" className="text-fp-accent hover:underline">contato@facilitaprep.com.br</a><br />
              Suporte: <a href="mailto:suporte@facilitaprep.com.br" className="text-fp-accent hover:underline">suporte@facilitaprep.com.br</a><br />
              WhatsApp: <a href="https://wa.me/5561994018161" className="text-fp-accent hover:underline">(61) 99401-8161</a><br />
              Telefone fixo: (61) 4042-7188
            </p>
          </section>
        </div>
      </main>
      <FooterCfm />
    </div>
  )
}
