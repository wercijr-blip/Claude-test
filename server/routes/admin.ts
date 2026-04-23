import { z } from 'zod'
import { router, adminProcedure, n8nProcedure } from '../_core/trpc.ts'
import { TRPCError } from '@trpc/server'
import { db } from '../db.ts'
import {
  users,
  securityEvents,
  monthlyEvidenceReports,
  bulletinSendLogs,
  adminNotifications,
} from '../../drizzle/schema.ts'
import { eq, desc, and, gte, lte } from 'drizzle-orm'
import type { Role } from '../../shared/types.ts'

const reportsRouter = router({
  // Salvar relatório mensal — autenticado via API key do n8n
  saveMonthly: n8nProcedure
    .input(
      z.object({
        clinicId: z.number().int(),
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
        specialtyCategory: z.string().max(100).optional(),
        medicalSpecialty: z.string().max(100),
        topic: z.string().max(255).optional(),
        totalArticlesFound: z.number().int().default(0),
        totalArticlesWithPdf: z.number().int().default(0),
        totalTopicsProcessed: z.number().int().default(0),
        avgArticlesPerTopic: z.number().optional(),
        evidenceStrength: z.enum(['forte', 'moderada', 'limitada']).optional(),
        topJournals: z.array(z.string()).optional(),
        summaryClaude: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db.insert(monthlyEvidenceReports).values({
        clinicId: input.clinicId,
        referenceMonth: input.referenceMonth,
        specialtyCategory: input.specialtyCategory ?? null,
        medicalSpecialty: input.medicalSpecialty,
        topic: input.topic ?? null,
        totalArticlesFound: input.totalArticlesFound,
        totalArticlesWithPdf: input.totalArticlesWithPdf,
        totalTopicsProcessed: input.totalTopicsProcessed,
        avgArticlesPerTopic: input.avgArticlesPerTopic ?? null,
        evidenceStrength: input.evidenceStrength ?? null,
        topJournals: input.topJournals ?? null,
        summaryClaude: input.summaryClaude ?? null,
        createdAt: new Date(),
      })

      return { id: (result as { insertId: number }).insertId }
    }),

  // Listar relatórios disponíveis
  list: adminProcedure
    .input(
      z.object({
        medicalSpecialty: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        clinicId: z.number().int().optional(),
        limit: z.number().int().max(100).default(50),
      }),
    )
    .query(async ({ input }) => {
      const conditions = []
      if (input.medicalSpecialty)
        conditions.push(eq(monthlyEvidenceReports.medicalSpecialty, input.medicalSpecialty))
      if (input.clinicId) conditions.push(eq(monthlyEvidenceReports.clinicId, input.clinicId))

      return db
        .select()
        .from(monthlyEvidenceReports)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(monthlyEvidenceReports.createdAt))
        .limit(input.limit)
    }),

  // Buscar relatório por mês e especialidade
  getByMonth: adminProcedure
    .input(
      z.object({
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
        medicalSpecialty: z.string().optional(),
        clinicId: z.number().int().optional(),
      }),
    )
    .query(async ({ input }) => {
      const conditions = [eq(monthlyEvidenceReports.referenceMonth, input.referenceMonth)]
      if (input.medicalSpecialty)
        conditions.push(eq(monthlyEvidenceReports.medicalSpecialty, input.medicalSpecialty))
      if (input.clinicId) conditions.push(eq(monthlyEvidenceReports.clinicId, input.clinicId))

      return db
        .select()
        .from(monthlyEvidenceReports)
        .where(and(...conditions))
        .orderBy(desc(monthlyEvidenceReports.createdAt))
    }),
})

const bulletinRouter = router({
  // Médicos que recebem boletim mensal
  getDoctors: n8nProcedure.query(async () => {
    return db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        bulletinEmail: users.bulletinEmail,
        role: users.role,
      })
      .from(users)
      .where(
        and(
          eq(users.receiveMonthlyBulletin, true),
          eq(users.ativo, true),
        ),
      )
  }),

  // Registrar envio de boletim por médico e mês
  logSend: n8nProcedure
    .input(
      z.object({
        doctorId: z.number().int(),
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
        articlesCount: z.number().int().default(0),
        metaAnalysesCount: z.number().int().default(0),
        sentAt: z.string().datetime().optional(),
        emailUsed: z.string().email().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db.insert(bulletinSendLogs).values({
        doctorId: input.doctorId,
        referenceMonth: input.referenceMonth,
        articlesCount: input.articlesCount,
        metaAnalysesCount: input.metaAnalysesCount,
        sentAt: input.sentAt ? new Date(input.sentAt) : new Date(),
        emailUsed: input.emailUsed ?? null,
        createdAt: new Date(),
      })

      return { id: (result as { insertId: number }).insertId }
    }),
})

export const adminRouter = router({
  // Listar equipe
  listarUsuarios: adminProcedure.query(async () => {
    return db.select().from(users).orderBy(users.createdAt)
  }),

  // Alterar role de usuário
  alterarRole: adminProcedure
    .input(z.object({ userId: z.number(), role: z.enum(['secretaria', 'medico', 'admin']) }))
    .mutation(async ({ input }) => {
      const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)
      if (!user) throw new TRPCError({ code: 'NOT_FOUND' })

      await db
        .update(users)
        .set({ role: input.role as Role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))

      return { ok: true }
    }),

  // Ativar/desativar usuário
  toggleAtivo: adminProcedure
    .input(z.object({ userId: z.number(), ativo: z.boolean() }))
    .mutation(async ({ input }) => {
      await db
        .update(users)
        .set({ ativo: input.ativo, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
      return { ok: true }
    }),

  // Log de eventos de segurança
  listarEventos: adminProcedure
    .input(z.object({ limit: z.number().max(200).default(50) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(securityEvents)
        .orderBy(desc(securityEvents.createdAt))
        .limit(input.limit)
    }),

  // Sub-roteadores do pipeline de conhecimento
  reports: reportsRouter,
  bulletin: bulletinRouter,

  // Criar notificação interna para o admin
  notify: n8nProcedure
    .input(
      z.object({
        type: z.string().max(100),
        message: z.string(),
        month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const [result] = await db.insert(adminNotifications).values({
        type: input.type,
        message: input.message,
        month: input.month ?? null,
        read: false,
        createdAt: new Date(),
      })

      return { id: (result as { insertId: number }).insertId }
    }),

  // Listar notificações não lidas
  notifications: adminProcedure
    .input(z.object({ limit: z.number().int().max(100).default(20) }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(adminNotifications)
        .where(eq(adminNotifications.read, false))
        .orderBy(desc(adminNotifications.createdAt))
        .limit(input.limit)
    }),

  // Marcar notificação como lida
  markNotificationRead: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await db
        .update(adminNotifications)
        .set({ read: true })
        .where(eq(adminNotifications.id, input.id))
      return { ok: true }
    }),
})
