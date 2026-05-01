import { z } from 'zod'
import { router, protectedProcedure, medicoProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import { consultasInicio, accessTokens, precadastros, users } from '../../drizzle/schema.ts'
import { eq, desc, inArray } from 'drizzle-orm'
import { decrypt } from '../_core/encryption.ts'
import { extrairDadosExame, calcularSimilaridadeNome, parseDateBR, isDataValida } from '../examValidation.ts'
import { gerarPedidosExames } from '../pdfExameRequest.ts'
import { gerarOrientacaoInicialPdf } from '../pdfOrientacaoInicial.ts'
import { assinarPdf } from '../pdfSigner.ts'
import { uploadBuffer, getPresignedUrl } from '../storage.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import {
  enviarExameAprovadoIa,
  enviarAnaliseHumanaExame,
  enviarExameRejeitadoData,
  enviarNotificacaoMedicoPendente,
  enviarExameRejeitadoMedico,
  enviarSolicitacaoReenvio,
} from '../email.ts'
import { env } from '../_core/env.ts'
import { DIAS_VALIDADE_LINK_UPLOAD } from '../../shared/const.ts'

function assertPatient(session: unknown): asserts session is { type: 'patient'; tokenId: number; pacienteId: number | null } {
  if (!session || (session as { type: string }).type !== 'patient') {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
}

interface InfoPaciente {
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
}

async function getInfoPaciente(tokenId: number): Promise<InfoPaciente> {
  const [precad] = await db
    .select({
      nomeEncrypted: precadastros.nomeEncrypted,
      cpfEncrypted: precadastros.cpfEncrypted,
      emailEncrypted: precadastros.emailEncrypted,
      telefoneEncrypted: precadastros.telefoneEncrypted,
    })
    .from(precadastros)
    .where(eq(precadastros.accessTokenId, tokenId))
    .limit(1)

  if (precad) {
    return {
      nome: decrypt(precad.nomeEncrypted),
      cpf: decrypt(precad.cpfEncrypted),
      email: decrypt(precad.emailEncrypted),
      telefone: decrypt(precad.telefoneEncrypted),
    }
  }

  // Fallback: accessTokens.patientEmail
  const [token] = await db
    .select({ patientEmail: accessTokens.patientEmail })
    .from(accessTokens)
    .where(eq(accessTokens.id, tokenId))
    .limit(1)

  return { nome: 'Paciente', cpf: null, email: token?.patientEmail ?? null, telefone: null }
}

async function getMedicosEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(inArray(users.role, ['medico', 'admin']))
  return rows.map(r => r.email).filter(Boolean) as string[]
}

export const consultaRouter = router({
  // Paciente escolhe tipo de consulta e responde se tem exame recente
  iniciar: protectedProcedure
    .input(z.object({
      tipoConsulta: z.enum(['primeiro_atendimento', 'ja_faco_prep']),
      temExameRecente: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)

      const [existing] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (existing && existing.status !== 'aguardando_escolha') {
        return { consultaId: existing.id, status: existing.status }
      }

      const linkExpiresAt = new Date()
      linkExpiresAt.setDate(linkExpiresAt.getDate() + DIAS_VALIDADE_LINK_UPLOAD)

      const data = {
        tipoConsulta: input.tipoConsulta,
        temExameRecente: input.temExameRecente,
        status: 'aguardando_upload',
        linkExpiresAt,
        updatedAt: new Date(),
      }

      if (existing) {
        await db.update(consultasInicio).set(data).where(eq(consultasInicio.id, existing.id))
        return { consultaId: existing.id, status: 'aguardando_upload' }
      }

      await db.insert(consultasInicio).values({ tokenId: ctx.session.tokenId, ...data })

      const [inserted] = await db
        .select({ id: consultasInicio.id })
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .orderBy(desc(consultasInicio.createdAt))
        .limit(1)

      return { consultaId: inserted.id, status: 'aguardando_upload' }
    }),

  // Gerar e retornar PDFs dos pedidos de exame (para quem não tem exame recente)
  gerarPedidos: protectedProcedure
    .mutation(async ({ ctx }) => {
      assertPatient(ctx.session)

      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (!consulta?.tipoConsulta) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Inicie o atendimento primeiro.' })

      // Sempre regenera os pedidos para garantir que a lista de exames atual
      // (definida em shared/const.ts) esteja sendo usada. PDFs antigos no S3
      // ficam apenas como histórico — o paciente baixa via URL nova retornada
      // abaixo.
      const info = await getInfoPaciente(ctx.session.tokenId)

      const paciente = { nome: info.nome, cpf: info.cpf }
      const tokenId = ctx.session.tokenId

      const { completo, ist, hiv, densitometria } = await gerarPedidosExames(
        consulta.tipoConsulta as 'primeiro_atendimento' | 'ja_faco_prep',
        paciente,
        tokenId,
      )

      // Documento de Orientação Inicial — vai junto com os pedidos para
      // explicar o paciente sobre os exames antes de iniciar a PrEP.
      const orientacaoInicial = await gerarOrientacaoInicialPdf({ tokenId, paciente })

      const [
        { buffer: completoAssinado },
        { buffer: istAssinado },
        { buffer: hivAssinado },
        { buffer: densitometriaAssinada },
        { buffer: orientacaoAssinada },
      ] = await Promise.all([
        assinarPdf(completo, 'Pedido de Exames Completo PrEP — Facilita PrEP'),
        assinarPdf(ist, 'Pedido de Exames Sorológicos IST — Facilita PrEP'),
        assinarPdf(hiv, 'Pedido de Exame Anti-HIV — Facilita PrEP'),
        assinarPdf(densitometria, 'Pedido de Densitometria Óssea — Facilita PrEP'),
        assinarPdf(orientacaoInicial, 'Orientação para Início da PrEP — Facilita PrEP'),
      ])

      const ts = Date.now()
      const keyCompleto = `pedidos/${tokenId}/${ts}-completo.pdf`
      const keyIst = `pedidos/${tokenId}/${ts}-ist.pdf`
      const keyHiv = `pedidos/${tokenId}/${ts}-hiv.pdf`
      const keyDensit = `pedidos/${tokenId}/${ts}-densitometria.pdf`
      const keyOri = `pedidos/${tokenId}/${ts}-orientacao-inicial.pdf`

      await Promise.all([
        uploadBuffer(keyCompleto, completoAssinado, 'application/pdf'),
        uploadBuffer(keyIst, istAssinado, 'application/pdf'),
        uploadBuffer(keyHiv, hivAssinado, 'application/pdf'),
        uploadBuffer(keyDensit, densitometriaAssinada, 'application/pdf'),
        uploadBuffer(keyOri, orientacaoAssinada, 'application/pdf'),
      ])

      await db.update(consultasInicio)
        .set({
          pedidoCompletoS3Key: keyCompleto,
          pedidoIstS3Key: keyIst,
          pedidoHivS3Key: keyHiv,
          pedidoDensitometriaS3Key: keyDensit,
          updatedAt: new Date(),
        })
        .where(eq(consultasInicio.id, consulta.id))

      return {
        urlCompleto: await getPresignedUrl(keyCompleto, 3600),
        urlIst: await getPresignedUrl(keyIst, 3600),
        urlHiv: await getPresignedUrl(keyHiv, 3600),
        urlDensitometria: await getPresignedUrl(keyDensit, 3600),
        urlOrientacao: await getPresignedUrl(keyOri, 3600),
      }
    }),

  // Paciente faz upload do exame — aplica as 6 regras de validação
  uploadExame: protectedProcedure
    .input(z.object({
      // Aceita apenas chaves no formato exames-inicio/uuid.ext — bloqueia path traversal
      s3Key: z.string().regex(/^exames-inicio\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|pdf)$/, 'Chave de arquivo inválida'),
    }))
    .mutation(async ({ input, ctx }) => {
      assertPatient(ctx.session)

      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (!consulta) throw new TRPCError({ code: 'NOT_FOUND' })

      // Already approved — no reprocessing
      if (consulta.status === 'aprovado_ia' || consulta.status === 'aprovado') {
        return { status: consulta.status }
      }

      if (consulta.linkExpiresAt && consulta.linkExpiresAt < new Date()) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'O prazo para envio do exame expirou. Entre em contato com a clínica.' })
      }

      await db.update(consultasInicio)
        .set({ exameS3Key: input.s3Key, status: 'em_validacao_ia', updatedAt: new Date() })
        .where(eq(consultasInicio.id, consulta.id))

      const info = await getInfoPaciente(ctx.session.tokenId)
      const nomeCadastro = info.nome

      // ── AI Extraction ────────────────────────────────────────────
      let extracao
      try {
        extracao = await extrairDadosExame(input.s3Key)
      } catch (err) {
        console.error('[consulta] Falha na extração IA:', (err as Error).message)
        // Fallback: send to medical review
        await db.update(consultasInicio)
          .set({ status: 'pendente_revisao_medica', motivoRejeicao: 'Erro na análise automática', updatedAt: new Date() })
          .where(eq(consultasInicio.id, consulta.id))
        await _notificarMedicosEPaciente(info, false, 'Erro na análise automática (IA indisponível)')
        return { status: 'pendente_revisao_medica' as const }
      }

      const tentativasAtuais = consulta.tentativasReenvio ?? 0

      // ── REGRA PRÉ-A — Tipo de exame ≠ HIV ──────────────────────
      // Documento NÃO é exame de HIV (ex.: creatinina, hemograma, RG,
      // comprovante). Só rejeita devolvendo ao paciente — não escala
      // pro médico. O médico só vê quando IA não consegue LER o exame
      // de HIV; se o paciente mandou o arquivo errado, é problema dele
      // mandar o arquivo certo.
      if (extracao.tipoExameDetectado === 'outro') {
        const novasTentativas = tentativasAtuais + 1
        const motivo = 'Documento enviado não parece ser um exame de HIV'

        await db.update(consultasInicio)
          .set({
            status: 'rejeitado_tipo_invalido',
            resultadoIa: extracao,
            motivoRejeicao: motivo,
            tentativasReenvio: novasTentativas,
            updatedAt: new Date(),
          })
          .where(eq(consultasInicio.id, consulta.id))

        if (info.telefone) {
          const msg = `Olá ${info.nome}, o documento enviado não parece ser um exame de HIV. Confira o arquivo e envie novamente: ${env.APP_URL}/inicio`
          await enviarWhatsApp(info.telefone, msg).catch(console.error)
        }

        return { status: 'rejeitado_tipo_invalido' as const, tentativasReenvio: novasTentativas }
      }

      // ── REGRA A — Data inválida ──────────────────────────────────
      const dataExame = extracao.dataExame ? parseDateBR(extracao.dataExame) : null
      if (!isDataValida(dataExame)) {
        console.log('[consulta] Rejeitando por data inválida', {
          dataExtraidaPelaIa: extracao.dataExame,
          dataParsed: dataExame?.toISOString() ?? null,
          hoje: new Date().toISOString(),
          confiancaIa: extracao.confianca,
        })
        const novasTentativas = tentativasAtuais + 1

        // REGRA B: Após 2 rejeições por data, forçar revisão médica
        if (novasTentativas >= 2) {
          await db.update(consultasInicio)
            .set({
              status: 'pendente_revisao_medica',
              resultadoIa: extracao,
              motivoRejeicao: 'Limite de tentativas por data inválida atingido',
              tentativasReenvio: novasTentativas,
              updatedAt: new Date(),
            })
            .where(eq(consultasInicio.id, consulta.id))

          await _notificarMedicosEPaciente(info, false, `Paciente atingiu ${novasTentativas} rejeições por data inválida`)
          return { status: 'pendente_revisao_medica' as const, tentativasReenvio: novasTentativas }
        }

        await db.update(consultasInicio)
          .set({
            status: 'rejeitado_data_invalida',
            resultadoIa: extracao,
            motivoRejeicao: 'Data do exame superior a 7 dias',
            tentativasReenvio: novasTentativas,
            updatedAt: new Date(),
          })
          .where(eq(consultasInicio.id, consulta.id))

        if (info.email) {
          await enviarExameRejeitadoData(info.email, info.nome, novasTentativas, env.APP_URL).catch(console.error)
        }
        if (info.telefone) {
          const msg = `Olá ${info.nome}, seu exame foi rejeitado: precisa ter sido realizado há até 7 dias (inclusive). Envie um novo: ${env.APP_URL}/inicio (Tentativa ${novasTentativas}/2)`
          await enviarWhatsApp(info.telefone, msg).catch(console.error)
        }

        return { status: 'rejeitado_data_invalida' as const, tentativasReenvio: novasTentativas }
      }

      // ── REGRA C — HIV reagente ───────────────────────────────────
      if (extracao.resultadoHiv === 'reagente') {
        await db.update(consultasInicio)
          .set({
            status: 'pendente_revisao_medica_urgente',
            resultadoIa: extracao,
            motivoRejeicao: 'Resultado HIV possivelmente reagente',
            updatedAt: new Date(),
          })
          .where(eq(consultasInicio.id, consulta.id))

        await _notificarMedicosEPaciente(info, true, 'Resultado HIV possivelmente reagente — revisão urgente')
        return { status: 'pendente_revisao_medica_urgente' as const }
      }

      // ── REGRA D — Nome não bate ──────────────────────────────────
      // Mesma lógica de retry da regra de data: 1ª tentativa devolve para o paciente
      // reenviar (ele pode ter mandado o exame errado). Na 2ª, escala para médico.
      if (extracao.nomeExame && nomeCadastro) {
        const sim = calcularSimilaridadeNome(extracao.nomeExame, nomeCadastro)
        if (sim < 0.70) {
          const novasTentativas = tentativasAtuais + 1
          const motivoCurto = `Nome divergente — exame: "${extracao.nomeExame}", cadastro: "${nomeCadastro}" (${Math.round(sim * 100)}%)`

          if (novasTentativas >= 2) {
            await db.update(consultasInicio)
              .set({
                status: 'pendente_revisao_medica',
                resultadoIa: extracao,
                motivoRejeicao: `Limite de tentativas por nome divergente atingido — ${motivoCurto}`,
                tentativasReenvio: novasTentativas,
                updatedAt: new Date(),
              })
              .where(eq(consultasInicio.id, consulta.id))

            await _notificarMedicosEPaciente(info, false, motivoCurto)
            return { status: 'pendente_revisao_medica' as const, tentativasReenvio: novasTentativas }
          }

          await db.update(consultasInicio)
            .set({
              status: 'rejeitado_nome_invalido',
              resultadoIa: extracao,
              motivoRejeicao: motivoCurto,
              tentativasReenvio: novasTentativas,
              updatedAt: new Date(),
            })
            .where(eq(consultasInicio.id, consulta.id))

          if (info.telefone) {
            const msg = `Olá ${info.nome}, o nome no exame ("${extracao.nomeExame}") não confere com o cadastro ("${nomeCadastro}"). Verifique e envie novamente: ${env.APP_URL}/inicio (Tentativa ${novasTentativas}/2)`
            await enviarWhatsApp(info.telefone, msg).catch(console.error)
          }

          return { status: 'rejeitado_nome_invalido' as const, tentativasReenvio: novasTentativas }
        }
      }

      // ── REGRA E — Baixa confiança ────────────────────────────────
      if (extracao.confianca < 0.85) {
        await db.update(consultasInicio)
          .set({
            status: 'pendente_revisao_medica',
            resultadoIa: extracao,
            motivoRejeicao: `Confiança da IA abaixo do mínimo (${Math.round(extracao.confianca * 100)}%)`,
            updatedAt: new Date(),
          })
          .where(eq(consultasInicio.id, consulta.id))

        await _notificarMedicosEPaciente(info, false, `Baixa confiança na leitura do exame (${Math.round(extracao.confianca * 100)}%)`)
        return { status: 'pendente_revisao_medica' as const }
      }

      // ── REGRA F — Auto-aprovação ─────────────────────────────────
      await db.update(consultasInicio)
        .set({
          status: 'aprovado_ia',
          resultadoIa: extracao,
          dataExameValidado: extracao.dataExame,
          resultadoHivValidado: extracao.resultadoHiv,
          updatedAt: new Date(),
        })
        .where(eq(consultasInicio.id, consulta.id))

      if (info.email) {
        await enviarExameAprovadoIa(info.email, info.nome, env.APP_URL).catch(console.error)
      }
      if (info.telefone) {
        const msg = `Olá ${info.nome}, seu exame foi aprovado! Continue seu cadastro: ${env.APP_URL}/formulario`
        await enviarWhatsApp(info.telefone, msg).catch(console.error)
      }

      return { status: 'aprovado_ia' as const }
    }),

  // Paciente consulta status atual
  status: protectedProcedure
    .query(async ({ ctx }) => {
      assertPatient(ctx.session)

      const [consulta] = await db
        .select()
        .from(consultasInicio)
        .where(eq(consultasInicio.tokenId, ctx.session.tokenId))
        .limit(1)

      if (!consulta) {
        return {
          status: 'aguardando_escolha' as const,
          tipoConsulta: null,
          temExameRecente: null,
          motivoRejeicao: null,
          linkExpiresAt: null,
          tentativasReenvio: 0,
          dataExame: null,
          resultadoHiv: null,
          nomeExame: null,
          nomeCadastro: null,
          tipoExameDetectado: null,
          checks: null,
        }
      }

      const resultadoIa = consulta.resultadoIa as
        | {
            dataExame?: string
            resultadoHiv?: string
            nomeExame?: string
            tipoExameDetectado?: 'hiv' | 'outro' | 'nao_identificado'
            confianca?: number
          }
        | null

      // Nome cadastrado para comparação visual (mostrar ao paciente
      // o que a IA leu vs. o que está no cadastro).
      const info = await getInfoPaciente(ctx.session.tokenId).catch(() => null)

      // Calcula os 3 critérios para mostrar ao paciente sempre que houver
      // resultado da IA — mesmo em rejeição. Permite ele entender por que
      // foi reprovado.
      type CheckEstado = 'ok' | 'falhou' | 'nao_avaliado'
      let checkTipo: CheckEstado = 'nao_avaliado'
      let checkNome: CheckEstado = 'nao_avaliado'
      let checkResultado: CheckEstado = 'nao_avaliado'
      let checkData: CheckEstado = 'nao_avaliado'

      if (resultadoIa) {
        const tipoDetec = resultadoIa.tipoExameDetectado
        if (tipoDetec === 'hiv') checkTipo = 'ok'
        else if (tipoDetec === 'outro') checkTipo = 'falhou'

        if (resultadoIa.nomeExame && info?.nome) {
          const sim = calcularSimilaridadeNome(resultadoIa.nomeExame, info.nome)
          checkNome = sim >= 0.70 ? 'ok' : 'falhou'
        }

        if (resultadoIa.resultadoHiv === 'nao_reagente') checkResultado = 'ok'
        else if (resultadoIa.resultadoHiv === 'reagente' || resultadoIa.resultadoHiv === 'inconclusivo') {
          checkResultado = 'falhou'
        }

        if (resultadoIa.dataExame) {
          const d = parseDateBR(resultadoIa.dataExame)
          checkData = isDataValida(d) ? 'ok' : 'falhou'
        }
      }

      return {
        status: consulta.status,
        tipoConsulta: consulta.tipoConsulta,
        temExameRecente: consulta.temExameRecente,
        motivoRejeicao: consulta.motivoRejeicao,
        linkExpiresAt: consulta.linkExpiresAt,
        tentativasReenvio: consulta.tentativasReenvio ?? 0,
        dataExame: consulta.dataExameValidado ?? resultadoIa?.dataExame ?? null,
        resultadoHiv: consulta.resultadoHivValidado ?? resultadoIa?.resultadoHiv ?? null,
        nomeExame: resultadoIa?.nomeExame ?? null,
        nomeCadastro: info?.nome ?? null,
        tipoExameDetectado: resultadoIa?.tipoExameDetectado ?? null,
        checks: resultadoIa ? {
          tipo: checkTipo,
          nome: checkNome,
          resultado: checkResultado,
          data: checkData,
        } : null,
      }
    }),

  // Médico: listar exames aguardando revisão manual
  medico: router({
    listarRevisoes: medicoProcedure
      .query(async () => {
        const rows = await db
          .select({
            id: consultasInicio.id,
            tokenId: consultasInicio.tokenId,
            tipoConsulta: consultasInicio.tipoConsulta,
            resultadoIa: consultasInicio.resultadoIa,
            motivoRejeicao: consultasInicio.motivoRejeicao,
            tentativasReenvio: consultasInicio.tentativasReenvio,
            exameS3Key: consultasInicio.exameS3Key,
            status: consultasInicio.status,
            createdAt: consultasInicio.createdAt,
            patientEmail: accessTokens.patientEmail,
            nomeEncrypted: precadastros.nomeEncrypted,
          })
          .from(consultasInicio)
          .leftJoin(accessTokens, eq(accessTokens.id, consultasInicio.tokenId))
          .leftJoin(precadastros, eq(precadastros.accessTokenId, consultasInicio.tokenId))
          .where(inArray(consultasInicio.status, ['pendente_revisao_medica', 'pendente_revisao_medica_urgente', 'em_validacao_medica']))
          .orderBy(desc(consultasInicio.createdAt))

        return Promise.all(
          rows.map(async (r) => {
            const { nomeEncrypted, ...rest } = r
            return {
              ...rest,
              urlExame: r.exameS3Key ? await getPresignedUrl(r.exameS3Key, 600) : null,
              urgente: r.status === 'pendente_revisao_medica_urgente',
              nomePaciente: nomeEncrypted ? decrypt(nomeEncrypted) : (r.patientEmail ?? `#${r.id}`),
            }
          }),
        )
      }),

    validar: medicoProcedure
      .input(z.object({
        consultaId: z.number(),
        acao: z.enum([
          'aprovar',
          'recusar',
          'solicitar_reenvio',
          'recomendar_consulta',
          'encaminhar_especialista',
          'solicitar_confirmacao',
        ]),
        resultadoHiv: z.enum(['reagente', 'nao_reagente']).optional(),
        dataExame: z.string().optional(),
        observacoes: z.string().min(10, 'O comentário deve ter pelo menos 10 caracteres'),
      }))
      .mutation(async ({ input, ctx }) => {
        const [consulta] = await db
          .select()
          .from(consultasInicio)
          .where(eq(consultasInicio.id, input.consultaId))
          .limit(1)

        if (!consulta) throw new TRPCError({ code: 'NOT_FOUND' })

        const acaoParaStatus: Record<string, string> = {
          aprovar: 'aprovado',
          recusar: 'rejeitado',
          recomendar_consulta: 'rejeitado',
          encaminhar_especialista: 'rejeitado',
          solicitar_reenvio: 'aguardando_upload',
          solicitar_confirmacao: 'aguardando_upload',
        }

        const isReenvio = input.acao === 'solicitar_reenvio' || input.acao === 'solicitar_confirmacao'

        await db.update(consultasInicio)
          .set({
            status: acaoParaStatus[input.acao],
            validadoPorId: (ctx.session as { id: number }).id,
            validadoEm: new Date(),
            resultadoHivValidado: input.resultadoHiv ?? undefined,
            dataExameValidado: input.dataExame ?? undefined,
            observacoesMedico: input.observacoes,
            ...(isReenvio ? { tentativasReenvio: 0, motivoRejeicao: null } : {}),
            updatedAt: new Date(),
          })
          .where(eq(consultasInicio.id, input.consultaId))

        const info = await getInfoPaciente(consulta.tokenId)

        if (input.acao === 'aprovar') {
          if (info.email) await enviarExameAprovadoIa(info.email, info.nome, env.APP_URL).catch(console.error)
          if (info.telefone) await enviarWhatsApp(info.telefone, `Olá ${info.nome}, seu exame foi aprovado pelo médico! Continue seu cadastro: ${env.APP_URL}/formulario`).catch(console.error)
        } else if (isReenvio) {
          if (info.email) await enviarSolicitacaoReenvio(info.email, info.nome, input.observacoes, env.APP_URL).catch(console.error)
          if (info.telefone) await enviarWhatsApp(info.telefone, `Olá ${info.nome}, nosso médico solicita um novo exame. Motivo: ${input.observacoes}. Acesse: ${env.APP_URL}/inicio`).catch(console.error)
        } else {
          if (info.email) await enviarExameRejeitadoMedico(info.email, info.nome, input.observacoes).catch(console.error)
          if (info.telefone) await enviarWhatsApp(info.telefone, `Olá ${info.nome}, sobre seu exame: ${input.observacoes}. Para mais informações: (61) 4042-7188`).catch(console.error)
        }

        return { ok: true }
      }),
  }),
})

// ── Helper: notifica médicos e paciente sobre revisão manual ──────────────────

async function _notificarMedicosEPaciente(
  info: InfoPaciente,
  urgente: boolean,
  motivo: string,
): Promise<void> {
  const [medicosEmails] = await Promise.all([getMedicosEmails()])
  const dashboardUrl = `${env.APP_URL}/medico`

  await Promise.all([
    enviarNotificacaoMedicoPendente(medicosEmails, urgente, info.nome, motivo, dashboardUrl).catch(console.error),
    info.email
      ? enviarAnaliseHumanaExame(info.email, info.nome).catch(console.error)
      : Promise.resolve(),
    info.telefone
      ? enviarWhatsApp(
          info.telefone,
          `Olá ${info.nome}, seu exame está em análise por um profissional. Prazo: até 2h em horário comercial (08-18h) ou 12h fora desse horário. Avisaremos quando estiver pronto.`,
        ).catch(console.error)
      : Promise.resolve(),
  ])
}
