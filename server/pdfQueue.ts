import { Queue, Worker } from 'bullmq'
import { randomBytes } from 'crypto'
import { env } from './_core/env.ts'
import { redis } from './_core/redis.ts'
import { db } from './db.ts'
import { pacientes, pdfs, consultasInicio, accessTokens, precadastros, pesquisaTokens } from '../drizzle/schema.ts'
import { eq, and, gt } from 'drizzle-orm'
import { decrypt } from './_core/encryption.ts'
import { gerarPrescricaoPdf, gerarFormularioPdf, assinarPdf } from './pdfSigner.ts'
import { preencherCadastroSUS } from './sus/preencherCadastro.ts'
import { preencherFichaAtendimento } from './sus/preencherFichaAtendimento.ts'
import { uploadBuffer, getBuffer } from './storage.ts'
import { enviarLinkAcessoIntake, enviarPrescricaoPronta, enviarPesquisaSatisfacao } from './email.ts'
import { enviarWhatsApp } from './whatsapp.ts'
import { logger } from './_core/logger.ts'

export const PDF_QUEUE_NAME = 'pdf-generation'
export const LEMBRETE_QUEUE_NAME = 'lembrete-exame'
export const PESQUISA_QUEUE_NAME = 'pesquisa-satisfacao'
export const LINK_ACESSO_QUEUE_NAME = 'link-acesso'

const connection = redis

// Upstash Redis free tier: 500k commands/month.
// BullMQ defaults burn through it in ~4 days with 3 active workers:
//   stalledInterval=30s × 3 workers = 6 stall-checks/min = ~260k checks/month
//   drainDelay=5s       × 3 workers = 36 polls/min       = ~1.5M polls/month
//
// drainDelay unit is SECONDS in BullMQ (not ms).
// Tuned per worker urgency — target: <80k commands/month total.
const SHARED_WORKER_SETTINGS = {
  lockDuration: 60_000,           // 60s lock (default 30s) — halves renewal RPCs
  stalledInterval: 60_000,        // stall check every 60s (default 30s)
  maxStalledCount: 1,             // move to failed after 1 stall (BullMQ default, explicit)
  removeOnComplete: { count: 10 }, // don't accumulate finished jobs in Redis
  removeOnFail: { count: 50 },
} as const

// Real-time: patient waits for docs — keep drainDelay short
const PDF_WORKER_OPTS    = { ...SHARED_WORKER_SETTINGS, drainDelay: 15 }  // 15s
// Delayed 24h: no urgency — poll infrequently
const PESQUISA_WORKER_OPTS = { ...SHARED_WORKER_SETTINGS, drainDelay: 120 } // 2min
// Daily cron at 11h: poll very infrequently
const LEMBRETE_WORKER_OPTS = { ...SHARED_WORKER_SETTINGS, drainDelay: 300 } // 5min

export const pdfQueue = new Queue(PDF_QUEUE_NAME, { connection })
export const lembreteQueue = new Queue(LEMBRETE_QUEUE_NAME, { connection })
export const pesquisaQueue = new Queue(PESQUISA_QUEUE_NAME, { connection })
export const linkAcessoQueue = new Queue(LINK_ACESSO_QUEUE_NAME, { connection })

export function startPdfWorker() {
  const worker = new Worker(
    PDF_QUEUE_NAME,
    async (job) => {
      const { pacienteId } = job.data as { pacienteId: number }

      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1)
      if (!p) throw new Error(`Paciente ${pacienteId} não encontrado`)

      // Determine tipoConsulta e buscar chaves dos pedidos de exame
      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, p.tokenId))
        .limit(1)
      const tipoConsulta = consulta?.tipoConsulta ?? 'primeiro_atendimento'

      const nome = decrypt(p.nomeEncrypted)
      const cpf = decrypt(p.cpfEncrypted)
      const dataNascimento = p.dataNascimentoEncrypted ? decrypt(p.dataNascimentoEncrypted) : null
      const nomeMae = p.nomeMaeEncrypted ? decrypt(p.nomeMaeEncrypted) : null
      const email = p.emailEncrypted ? decrypt(p.emailEncrypted) : null
      const telefone = p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null

      const pacienteDecrypted = {
        pacienteId,
        nome, cpf, dataNascimento, nomeMae, email, telefone,
        sexo: p.sexo,
        nomeSocial: p.nomeSocial,
        corRaca: p.corRaca,
        escolaridade: p.escolaridade,
        situacaoConjugal: p.situacaoConjugal,
        cep: p.cep,
        logradouro: p.logradouro,
        numero: p.numero,
        complemento: p.complemento,
        bairro: p.bairro,
        cidade: p.cidade,
        estado: p.estado,
        tipoAtendimento: p.tipoAtendimento,
        convenio: p.convenio,
        condutaJson: p.condutaJson,
        prescricaoJson: p.prescricaoJson,
      }

      // Config da clínica para os formulários SUS oficiais
      const configClinica = {
        cnes: env.SUS_CNES,
        crmTipo: env.MEDICO_CRM_TIPO,
        crmUf: env.MEDICO_CRM_UF,
        crmNumero: env.MEDICO_CRM,
      }

      const gerados: { filename: string; buffer: Buffer }[] = []

      // 1. Formulário clínico (sempre)
      const formularioBuf = await gerarFormularioPdf(pacienteDecrypted)
      const { buffer: signedForm, certificadoSerial: serialForm, assinadoEm: assinadoForm } =
        await assinarPdf(formularioBuf, 'Formulário Clínico PrEP — Facilita PrEP')
      const formKey = `pdfs/${pacienteId}/${Date.now()}-formulario.pdf`
      await uploadBuffer(formKey, signedForm, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: formKey, tipo: 'formulario', certificadoSerial: serialForm, assinadoEm: assinadoForm })
      gerados.push({ filename: 'formulario-clinico-prep.pdf', buffer: signedForm })

      // 2. Receita / Prescrição (sempre)
      const prescBuf = await gerarPrescricaoPdf(pacienteDecrypted)
      const { buffer: signedPresc, certificadoSerial: serialPresc, assinadoEm: assinadoPresc } =
        await assinarPdf(prescBuf, 'Receita PrEP — Facilita PrEP')
      const prescKey = `pdfs/${pacienteId}/${Date.now() + 1}-prescricao.pdf`
      await uploadBuffer(prescKey, signedPresc, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: prescKey, tipo: 'prescricao', certificadoSerial: serialPresc, assinadoEm: assinadoPresc })
      gerados.push({ filename: 'receita-prep.pdf', buffer: signedPresc })

      // 3. Cadastro SUS oficial (somente primeiro atendimento)
      // Form 01 — "Cadastramento de Usuário SUS PrEP" (NOV/2025)
      if (tipoConsulta === 'primeiro_atendimento') {
        const cadastroBuf = Buffer.from(await preencherCadastroSUS({
          pacienteId,
          cpf, nome, nomeMae: nomeMae ?? '', dataNascimento: dataNascimento ?? '',
          corRaca: p.corRaca,
          sexo: p.sexo,
          identidadeGenero: p.identidadeGenero,
          orientacaoSexual: p.orientacaoSexual,
          ufNascimento: p.ufNascimento,
          municipioNascimento: p.municipioNascimento,
          estado: p.estado,
          cidade: p.cidade,
          escolaridade: p.escolaridade,
          logradouro: p.logradouro,
          numero: p.numero,
          complemento: p.complemento,
          bairro: p.bairro,
          cep: p.cep,
          email,
          telefone,
        }))
        const { buffer: signedCad, certificadoSerial: serialCad, assinadoEm: assinadoCad } =
          await assinarPdf(cadastroBuf, 'Cadastro de Usuário SUS PrEP — Facilita PrEP')
        const cadKey = `pdfs/${pacienteId}/${Date.now() + 2}-cadastro-sus.pdf`
        await uploadBuffer(cadKey, signedCad, 'application/pdf')
        await db.insert(pdfs).values({ pacienteId, s3Key: cadKey, tipo: 'cadastro', certificadoSerial: serialCad, assinadoEm: assinadoCad })
        gerados.push({ filename: 'cadastro-usuario-sus-prep.pdf', buffer: signedCad })
      }

      // 4. Ficha de Atendimento PrEP (Form 02 SUS — sempre)
      // FEV/2025 — preenchida em primeiro atendimento e nas dispensações
      const fichaBuf = Buffer.from(await preencherFichaAtendimento({
        pacienteId,
        cpf, nome, nomeMae: nomeMae ?? '', dataNascimento: dataNascimento ?? '',
        dataExameHiv: consulta?.dataExameValidado ?? null,
        prepModalidade: 'PrEP diária',  // default — substituído quando tela de modalidade for criada
        tipoConsulta: tipoConsulta as 'primeiro_atendimento' | 'ja_faco_prep',
      }, configClinica))
      const { buffer: signedFicha, certificadoSerial: serialFicha, assinadoEm: assinadoFicha } =
        await assinarPdf(fichaBuf, 'Ficha de Atendimento PrEP — Facilita PrEP')
      const fichaKey = `pdfs/${pacienteId}/${Date.now() + 3}-ficha-atendimento.pdf`
      await uploadBuffer(fichaKey, signedFicha, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: fichaKey, tipo: 'ficha_atendimento', certificadoSerial: serialFicha, assinadoEm: assinadoFicha })
      gerados.push({ filename: 'ficha-atendimento-prep.pdf', buffer: signedFicha })

      // 5. Pedidos de exame (quando o paciente não tinha exame recente)
      if (consulta && !consulta.temExameRecente) {
        const pedidos = [
          { key: consulta.pedidoCompletoS3Key, tipo: 'pedido_completo', filename: 'pedido-exames-completo.pdf' },
          { key: consulta.pedidoIstS3Key, tipo: 'pedido_ist', filename: 'pedido-sorologicos-ist.pdf' },
          { key: consulta.pedidoHivS3Key, tipo: 'pedido_hiv', filename: 'pedido-anti-hiv.pdf' },
          { key: consulta.pedidoDensitometriaS3Key, tipo: 'pedido_densitometria', filename: 'pedido-densitometria-ossea.pdf' },
        ] as const

        for (const { key, tipo, filename } of pedidos) {
          if (!key) continue
          const buf = await getBuffer(key)
          await db.insert(pdfs).values({ pacienteId, s3Key: key, tipo, assinadoEm: consulta.createdAt })
          gerados.push({ filename, buffer: buf })
        }
      }

      // Enviar documentos por email
      const emailAddr = email ?? (await db
        .select({ patientEmail: accessTokens.patientEmail })
        .from(accessTokens)
        .where(eq(accessTokens.id, p.tokenId))
        .limit(1)
        .then(([r]) => r?.patientEmail ?? null))

      if (emailAddr) {
        await enviarPrescricaoPronta(emailAddr, nome, gerados).catch(console.error)
      }

      // WA-4: WhatsApp quando receita está pronta
      if (telefone) {
        const primeiroNome = nome.split(' ')[0]
        const validadeDate = new Date()
        validadeDate.setMonth(validadeDate.getMonth() + 4)
        const dataValidade = validadeDate.toLocaleDateString('pt-BR')
        const msg =
          `Olá ${primeiroNome}! 💊 Sua receita PrEP está pronta e assinada digitalmente.\n\n` +
          `📧 Enviamos todos os documentos para o seu e-mail com validade até ${dataValidade}.\n\n` +
          `Apresente a receita em qualquer farmácia ou retire gratuitamente numa UDM do SUS.\n\n` +
          `_Facilita PrEP_`
        await enviarWhatsApp(telefone, msg).catch(console.error)
      }

      // Agendar pesquisa de satisfação para 24h depois
      await pesquisaQueue.add(
        'enviar-pesquisa',
        { pacienteId, email: emailAddr, telefone, nome },
        { delay: 24 * 60 * 60 * 1000 },
      )

      return { pdfsGerados: gerados.length }
    },
    { connection, concurrency: 3, ...PDF_WORKER_OPTS },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[pdfQueue] Job ${job?.id} falhou`, { message: err.message })
  })

  return worker
}

export function startPesquisaWorker() {
  const worker = new Worker(
    PESQUISA_QUEUE_NAME,
    async (job) => {
      const { pacienteId, email, telefone, nome } = job.data as {
        pacienteId: number
        email: string | null
        telefone: string | null
        nome: string
      }

      const token = randomBytes(32).toString('hex')
      const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      await db
        .insert(pesquisaTokens)
        .values({ pacienteId, token, expiraEm })
        .onDuplicateKeyUpdate({ set: { token, expiraEm } })
      const link = `${env.APP_URL}/pesquisa/${pacienteId}/${token}`

      if (email) {
        await enviarPesquisaSatisfacao(email, nome, link).catch(console.error)
      }

      if (telefone) {
        const primeiroNome = nome.split(' ')[0]
        const msg =
          `Olá ${primeiroNome}! Como foi sua experiência com o atendimento PrEP?\n\n` +
          `Leva menos de 1 minuto responder nossa pesquisa:\n${link}\n\n_Facilita PrEP_`
        await enviarWhatsApp(telefone, msg).catch(console.error)
      }
    },
    { connection, ...PESQUISA_WORKER_OPTS },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[pesquisaQueue] Job ${job?.id} falhou`, { message: err.message })
  })

  return worker
}

export function startLembreteWorker() {
  const worker = new Worker(
    LEMBRETE_QUEUE_NAME,
    async () => {
      const agora = new Date()

      const pendentes = await db
        .select({
          consultaId: consultasInicio.id,
          tokenId: consultasInicio.tokenId,
          linkExpiresAt: consultasInicio.linkExpiresAt,
          patientEmail: accessTokens.patientEmail,
          precadNome: precadastros.nomeEncrypted,
          precadTelefone: precadastros.telefoneEncrypted,
        })
        .from(consultasInicio)
        .leftJoin(accessTokens, eq(accessTokens.id, consultasInicio.tokenId))
        .leftJoin(precadastros, eq(precadastros.accessTokenId, consultasInicio.tokenId))
        .where(
          and(
            eq(consultasInicio.status, 'aguardando_upload'),
            gt(consultasInicio.linkExpiresAt!, agora),
          ),
        )

      for (const p of pendentes) {
        if (!p.patientEmail) continue

        const nome = p.precadNome ? decrypt(p.precadNome).split(' ')[0] : 'Paciente'
        const linkBase = `${env.APP_URL}/inicio`

        await enviarLinkAcessoIntake(p.patientEmail, nome, linkBase, p.linkExpiresAt!).catch(console.error)

        if (p.precadTelefone) {
          const telefone = decrypt(p.precadTelefone)
          const msg =
            `Olá ${nome}! Estamos aguardando o envio do seu exame de HIV para dar continuidade ao atendimento PrEP.\n\n` +
            `Acesse o formulário e envie o exame: ${linkBase}\n\n` +
            `Prazo: ${p.linkExpiresAt?.toLocaleDateString('pt-BR')}\n\n_Facilita PrEP_`
          await enviarWhatsApp(telefone, msg).catch(console.error)
        }

        await db.update(consultasInicio)
          .set({ ultimoLembreteAt: agora })
          .where(eq(consultasInicio.id, p.consultaId))
      }

      return { enviados: pendentes.length }
    },
    { connection, ...LEMBRETE_WORKER_OPTS },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[lembreteQueue] Job ${job?.id} falhou`, { message: err.message })
  })

  return worker
}

export async function agendarLembreteDiario() {
  await lembreteQueue.add('lembrete-diario', {}, {
    repeat: { pattern: '0 11 * * *' },
    jobId: 'lembrete-diario-fixo',
  })
}

export async function enqueueGerarPdf(pacienteId: number) {
  return pdfQueue.add('gerar', { pacienteId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

// ── Link de Acesso Queue ──────────────────────────────────────
// Envia email + WhatsApp com o link de acesso ao formulário PrEP.
// Desacopla o envio da transação DB para garantir retry automático
// sem depender de retry do webhook Stripe.

export async function enqueueEnviarLinkAcesso(
  email: string,
  nome: string,
  telefone: string | null,
  link: string,
  expiresAt: Date,
) {
  return linkAcessoQueue.add(
    'enviar-link',
    { email, nome, telefone, link, expiresAt: expiresAt.toISOString() },
    { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } },
  )
}

export function startLinkAcessoWorker() {
  const worker = new Worker(
    LINK_ACESSO_QUEUE_NAME,
    async (job) => {
      const { email, nome, telefone, link, expiresAt } = job.data as {
        email: string
        nome: string
        telefone: string | null
        link: string
        expiresAt: string
      }

      const primeiroNome = nome.split(' ')[0]
      const expires = new Date(expiresAt)

      await enviarLinkAcessoIntake(email, nome, link, expires)

      if (telefone) {
        const msg =
          `Olá ${primeiroNome}! Seu acesso ao formulário PrEP está liberado.\n\n` +
          `Acesse o link abaixo para continuar:\n${link}\n\n` +
          `Válido até ${expires.toLocaleDateString('pt-BR')}.\n\n_Facilita PrEP_`
        await enviarWhatsApp(telefone, msg).catch(console.error)
      }
    },
    { connection, ...SHARED_WORKER_SETTINGS, drainDelay: 15 },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[linkAcessoQueue] Job ${job?.id} falhou (${job?.attemptsMade} tentativas)`, { message: err.message })
  })

  return worker
}
