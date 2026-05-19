import { Worker } from 'bullmq'
import { db } from '../db.ts'
import { pacientes, pdfs, consultasInicio, accessTokens } from '../../drizzle/schema.ts'
import { eq, and } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { gerarPrescricaoPdf, assinarPdf } from '../pdfSigner.ts'
import { gerarPedidosExames } from '../pdfExameRequest.ts'
import { preencherCadastroSUS } from '../sus/preencherCadastro.ts'
import { preencherFichaAtendimento, buildConfigClinica, mapPrepAdesaoLabel } from '../sus/preencherFichaAtendimento.ts'
import { gerarOrientacaoPdf } from '../pdfOrientacao.ts'
import { uploadBuffer } from '../storage.ts'
import { enviarPrescricaoPronta } from '../email.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { logger } from '../_core/logger.ts'
import {
  PDF_QUEUE_NAME, QUEUE_PREFIX, connection, PDF_WORKER_OPTS,
  pdfQueue, pesquisaQueue, persistDlq,
} from './queues.ts'

export async function enqueueGerarPdf(pacienteId: number) {
  // jobId determinístico evita enfileirar duplicados em clique duplo / retry de rede.
  return pdfQueue.add('gerar', { pacienteId }, {
    jobId: `pdf-${pacienteId}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

export function startPdfWorker() {
  const worker = new Worker(
    PDF_QUEUE_NAME,
    async (job) => {
      const { pacienteId } = job.data as { pacienteId: number }

      const [p] = await db.select().from(pacientes).where(eq(pacientes.id, pacienteId)).limit(1)
      if (!p) throw new Error(`Paciente ${pacienteId} não encontrado`)

      // Idempotência: se PDFs já foram gerados em tentativa anterior, pula geração.
      const [prescricaoExistente] = await db
        .select({ id: pdfs.id })
        .from(pdfs)
        .where(and(eq(pdfs.pacienteId, pacienteId), eq(pdfs.tipo, 'prescricao')))
        .limit(1)
      if (prescricaoExistente) {
        logger.info('[pdfQueue] PDFs já existentes, pulando geração (retry)', { pacienteId })
        return { skipped: true, reason: 'pdfs-already-generated' }
      }

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

      const configClinica = buildConfigClinica()
      const gerados: { filename: string; buffer: Buffer }[] = []

      // 1. Receita / Prescrição (sempre)
      const prescBuf = await gerarPrescricaoPdf(pacienteDecrypted)
      const { buffer: signedPresc, certificadoSerial: serialPresc, assinadoEm: assinadoPresc } =
        await assinarPdf(prescBuf, 'Receita PrEP — Facilita PrEP')
      const prescKey = `pdfs/${pacienteId}/${Date.now() + 1}-prescricao.pdf`
      await uploadBuffer(prescKey, signedPresc, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: prescKey, tipo: 'prescricao', certificadoSerial: serialPresc, assinadoEm: assinadoPresc })
      gerados.push({ filename: 'receita-prep.pdf', buffer: signedPresc })

      // 2. Cadastro SUS (somente primeiro atendimento)
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

      // 3. Ficha de Atendimento PrEP (sempre)
      const cond = (p.condutaJson ?? {}) as {
        temSintomasDst?: boolean
        usoDrogas?: boolean
        prepAdesao?: 'diaria' | 'sob_demanda'
      }
      const prepAdesaoLabel = mapPrepAdesaoLabel(cond.prepAdesao)
      const fichaBuf = Buffer.from(await preencherFichaAtendimento({
        pacienteId,
        cpf, nome, nomeMae: nomeMae ?? '', dataNascimento: dataNascimento ?? '',
        dataExameHiv: consulta?.dataExameValidado ?? null,
        prepModalidade: (p.prepModalidade as 'PrEP diária' | 'PrEP sob demanda' | null) ?? 'PrEP diária',
        tipoConsulta: tipoConsulta as 'primeiro_atendimento' | 'ja_faco_prep',
        prepAdesao: prepAdesaoLabel ?? null,
        temSintomasDst: cond.temSintomasDst ?? null,
        usoDrogas: cond.usoDrogas ?? null,
      }, configClinica))
      const { buffer: signedFicha, certificadoSerial: serialFicha, assinadoEm: assinadoFicha } =
        await assinarPdf(fichaBuf, 'Ficha de Atendimento PrEP — Facilita PrEP')
      const fichaKey = `pdfs/${pacienteId}/${Date.now() + 3}-ficha-atendimento.pdf`
      await uploadBuffer(fichaKey, signedFicha, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: fichaKey, tipo: 'ficha_atendimento', certificadoSerial: serialFicha, assinadoEm: assinadoFicha })
      gerados.push({ filename: 'ficha-atendimento-prep.pdf', buffer: signedFicha })

      // 4. Pedidos de exame (sempre)
      try {
        const tipoConsultaParaPedidos = (tipoConsulta ?? 'primeiro_atendimento') as
          'primeiro_atendimento' | 'ja_faco_prep'
        const { completo, ist, hiv, densitometria } = await gerarPedidosExames(
          tipoConsultaParaPedidos,
          { nome, cpf },
          p.tokenId,
        )
        const pedidosBuffers = [
          { buf: completo,      tipo: 'pedido_completo',      filename: 'pedido-exames-completo.pdf',      titulo: 'Pedido de Exames Completo — Facilita PrEP' },
          { buf: ist,           tipo: 'pedido_ist',           filename: 'pedido-sorologicos-ist.pdf',      titulo: 'Pedido de Sorologias IST — Facilita PrEP' },
          { buf: hiv,           tipo: 'pedido_hiv',           filename: 'pedido-anti-hiv.pdf',             titulo: 'Pedido de Anti-HIV — Facilita PrEP' },
          { buf: densitometria, tipo: 'pedido_densitometria', filename: 'pedido-densitometria-ossea.pdf',  titulo: 'Pedido de Densitometria Óssea — Facilita PrEP' },
        ] as const
        for (const { buf, tipo, filename, titulo } of pedidosBuffers) {
          try {
            const { buffer: signedBuf, certificadoSerial: serialPedido, assinadoEm: assinadoPedido } =
              await assinarPdf(buf, titulo)
            const signedKey = `pdfs/${pacienteId}/${Date.now() + 4}-${tipo}-assinado.pdf`
            await uploadBuffer(signedKey, signedBuf, 'application/pdf')
            await db.insert(pdfs).values({ pacienteId, s3Key: signedKey, tipo, certificadoSerial: serialPedido, assinadoEm: assinadoPedido })
            gerados.push({ filename, buffer: signedBuf })
          } catch (err) {
            logger.error('[pdfQueue] Falha ao assinar pedido (continuando)', { pacienteId, tipo, error: String(err) })
          }
        }
      } catch (err) {
        logger.error('[pdfQueue] Falha ao gerar pedidos de exame (continuando)', { pacienteId, error: String(err) })
      }

      // 5. Documento de Orientação (sempre)
      const orientacaoBuf = await gerarOrientacaoPdf({
        pacienteId,
        paciente: { nome, cpf },
        prepModalidade: (p.prepModalidade as 'PrEP diária' | 'PrEP sob demanda' | null) ?? 'PrEP diária',
        tipoConsulta: tipoConsulta as 'primeiro_atendimento' | 'ja_faco_prep',
        pedidosEmitidos: {
          completo: !!consulta?.pedidoCompletoS3Key,
          ist:      !!consulta?.pedidoIstS3Key,
          hiv:      !!consulta?.pedidoHivS3Key,
          densitometria: !!consulta?.pedidoDensitometriaS3Key,
        },
      })
      const { buffer: signedOri, certificadoSerial: serialOri, assinadoEm: assinadoOri } =
        await assinarPdf(orientacaoBuf, 'Documento de Orientação PrEP — Facilita PrEP')
      const oriKey = `pdfs/${pacienteId}/${Date.now() + 4}-orientacao.pdf`
      await uploadBuffer(oriKey, signedOri, 'application/pdf')
      await db.insert(pdfs).values({ pacienteId, s3Key: oriKey, tipo: 'orientacao', certificadoSerial: serialOri, assinadoEm: assinadoOri })
      gerados.push({ filename: 'orientacao-prep.pdf', buffer: signedOri })

      const emailAddr = email ?? (await db
        .select({ patientEmail: accessTokens.patientEmail })
        .from(accessTokens)
        .where(eq(accessTokens.id, p.tokenId))
        .limit(1)
        .then(([r]) => r?.patientEmail ?? null))

      if (emailAddr) {
        await enviarPrescricaoPronta(emailAddr, nome, gerados).catch((e: unknown) => logger.warn('[pdfQueue] notificação falhou', { error: String(e) }))
      }

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
        await enviarWhatsApp(telefone, msg).catch((e: unknown) => logger.warn('[pdfQueue] notificação falhou', { error: String(e) }))
      }

      await pesquisaQueue.add(
        'enviar-pesquisa',
        { pacienteId, email: emailAddr, telefone, nome },
        { delay: 24 * 60 * 60 * 1000 },
      )

      return { pdfsGerados: gerados.length }
    },
    // concurrency: 2 — reduzido de 3 para mitigar pico de memória com imagens grandes (pdf-lib).
    { connection, concurrency: 2, ...PDF_WORKER_OPTS, prefix: QUEUE_PREFIX },
  )

  worker.on('failed', (job, err) => {
    logger.error(`[pdfQueue] Job ${job?.id} falhou (${job?.attemptsMade} tentativas)`, { message: err.message })
    if ((job?.attemptsMade ?? 0) >= (job?.opts?.attempts ?? 3)) {
      void persistDlq(PDF_QUEUE_NAME, job, err)
    }
  })

  return worker
}
