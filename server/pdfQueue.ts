import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { env } from './_core/env.ts'
import { db } from './db.ts'
import { pacientes, pdfs, consultasInicio, accessTokens, precadastros } from '../drizzle/schema.ts'
import { eq, and, gt } from 'drizzle-orm'
import { decrypt } from './_core/encryption.ts'
import { gerarPrescricaoPdf, gerarFormularioPdf, assinarPdf } from './pdfSigner.ts'
import { gerarCadastroPdf } from './pdfCadastro.ts'
import { uploadBuffer, getBuffer } from './storage.ts'
import { enviarLinkAcessoIntake, enviarPrescricaoPronta, enviarPesquisaSatisfacao } from './email.ts'
import { enviarWhatsApp } from './whatsapp.ts'
import { gerarTokenPesquisa } from './routes/pesquisa.ts'

export const PDF_QUEUE_NAME = 'pdf-generation'
export const LEMBRETE_QUEUE_NAME = 'lembrete-exame'
export const PESQUISA_QUEUE_NAME = 'pesquisa-satisfacao'

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })

export const pdfQueue = new Queue(PDF_QUEUE_NAME, { connection })
export const lembreteQueue = new Queue(LEMBRETE_QUEUE_NAME, { connection })
export const pesquisaQueue = new Queue(PESQUISA_QUEUE_NAME, { connection })

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
      const email = p.emailEncrypted ? decrypt(p.emailEncrypted) : null
      const telefone = p.telefoneEncrypted ? decrypt(p.telefoneEncrypted) : null

      const pacienteDecrypted = {
        nome, cpf, dataNascimento, email, telefone,
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

      // 3. Ficha de cadastro (somente primeiro atendimento)
      if (tipoConsulta === 'primeiro_atendimento') {
        const cadastroBuf = await gerarCadastroPdf({
          nome, cpf, dataNascimento,
          sexo: p.sexo,
          nomeSocial: p.nomeSocial,
          corRaca: p.corRaca,
          escolaridade: p.escolaridade,
          situacaoConjugal: p.situacaoConjugal,
          email, telefone,
          cep: p.cep,
          logradouro: p.logradouro,
          numero: p.numero,
          complemento: p.complemento,
          bairro: p.bairro,
          cidade: p.cidade,
          estado: p.estado,
          tipoAtendimento: p.tipoAtendimento,
          convenio: p.convenio,
        })
        const { buffer: signedCad, certificadoSerial: serialCad, assinadoEm: assinadoCad } =
          await assinarPdf(cadastroBuf, 'Ficha de Cadastro PrEP — Facilita PrEP')
        const cadKey = `pdfs/${pacienteId}/${Date.now() + 2}-cadastro.pdf`
        await uploadBuffer(cadKey, signedCad, 'application/pdf')
        await db.insert(pdfs).values({ pacienteId, s3Key: cadKey, tipo: 'cadastro', certificadoSerial: serialCad, assinadoEm: assinadoCad })
        gerados.push({ filename: 'ficha-cadastro-prep.pdf', buffer: signedCad })
      }

      // 4. Pedidos de exame (quando o paciente não tinha exame recente)
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
    { connection, concurrency: 3 },
  )

  worker.on('failed', (job, err) => {
    console.error(`[pdfQueue] Job ${job?.id} falhou:`, err.message)
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

      const token = gerarTokenPesquisa(pacienteId)
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
    { connection },
  )

  worker.on('failed', (job, err) => {
    console.error(`[pesquisaQueue] Job ${job?.id} falhou:`, err.message)
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
    { connection },
  )

  worker.on('failed', (job, err) => {
    console.error(`[lembreteQueue] Job ${job?.id} falhou:`, err.message)
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
