import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { env } from './_core/env.ts'
import * as schema from '../drizzle/schema.ts'
import * as relations from '../drizzle/relations.ts'
import {
  sql,
  count,
  avg,
  desc,
  eq,
  gte,
  and,
  inArray,
  isNotNull,
} from 'drizzle-orm'
import type { ConsultationClinicalData } from '../drizzle/schema.ts'

const pool = mysql.createPool({
  uri:              env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit:  10,
  queueLimit:       100,
  connectTimeout:   10000,
})

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' })

export type Db = typeof db

// ─── USER CRUD ────────────────────────────────────────────────

export async function getUserByEmail(email: string) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)
  return rows[0] ?? null
}

export async function getUserById(id: number) {
  const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createUser(data: {
  email:              string
  passwordHash:       string
  name:               string
  role:               'admin' | 'doctor'
  clinicId?:          string | null
  specialty?:         string | null
  crm?:               string | null
  active?:            number
  mustChangePassword?: number
}) {
  const [result] = await db.insert(schema.users).values({
    email:              data.email,
    passwordHash:       data.passwordHash,
    name:               data.name,
    role:               data.role,
    clinicId:           data.clinicId ?? null,
    specialty:          data.specialty ?? null,
    crm:                data.crm ?? null,
    active:             data.active ?? 1,
    mustChangePassword: data.mustChangePassword ?? 1,
  })
  return (result as { insertId: number }).insertId
}

export async function updateUser(id: number, data: Record<string, unknown>) {
  await db.update(schema.users).set(data as never).where(eq(schema.users.id, id))
}

export async function listDoctorsByClinic(clinicId: string) {
  return db
    .select({
      id:                     schema.users.id,
      email:                  schema.users.email,
      name:                   schema.users.name,
      role:                   schema.users.role,
      specialty:              schema.users.specialty,
      crm:                    schema.users.crm,
      active:                 schema.users.active,
      mustChangePassword:     schema.users.mustChangePassword,
      bulletinEmail:          schema.users.bulletinEmail,
      receiveMonthlyBulletin: schema.users.receiveMonthlyBulletin,
      createdAt:              schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.clinicId, clinicId))
    .orderBy(schema.users.name)
}

export async function countAllUsers(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(schema.users)
  return row?.count ?? 0
}

// ─── CONSULTATION CRUD ────────────────────────────────────────

export async function getConsultationById(id: number) {
  const rows = await db
    .select()
    .from(schema.consultations)
    .where(eq(schema.consultations.id, id))
    .limit(1)
  return rows[0] ?? null
}

export async function listConsultationsByUser(userId: number) {
  return db
    .select()
    .from(schema.consultations)
    .where(eq(schema.consultations.userId, userId))
    .orderBy(desc(schema.consultations.createdAt))
}

export async function createConsultation(data: typeof schema.consultations.$inferInsert) {
  const [result] = await db.insert(schema.consultations).values(data)
  return (result as { insertId: number }).insertId
}

export async function updateConsultation(id: number, data: Record<string, unknown>) {
  await db.update(schema.consultations).set(data as never).where(eq(schema.consultations.id, id))
}

// ─── KNOWLEDGE TOPICS ────────────────────────────────────────

export async function createKnowledgeTopic(data: typeof schema.knowledgeTopics.$inferInsert) {
  const [result] = await db.insert(schema.knowledgeTopics).values(data)
  return (result as { insertId: number }).insertId
}

export async function listKnowledgeTopicsForClinic(
  clinicId: string,
  filters?: {
    status?:            'pending' | 'sent' | 'done'
    userId?:            number
    medicalSpecialty?:  string
    specialtyCategory?: string
    dateFrom?:          string
    dateTo?:            string
  },
) {
  const conditions = [eq(schema.knowledgeTopics.clinicId, clinicId)]

  if (filters?.status)            conditions.push(eq(schema.knowledgeTopics.status, filters.status))
  if (filters?.userId)            conditions.push(eq(schema.knowledgeTopics.sharedBy, filters.userId))
  if (filters?.medicalSpecialty)  conditions.push(eq(schema.knowledgeTopics.medicalSpecialty, filters.medicalSpecialty))
  if (filters?.specialtyCategory) conditions.push(eq(schema.knowledgeTopics.specialtyCategory, filters.specialtyCategory))

  return db
    .select()
    .from(schema.knowledgeTopics)
    .where(and(...conditions))
    .orderBy(desc(schema.knowledgeTopics.createdAt))
}

export async function updateKnowledgeTopicStatus(id: number, status: 'pending' | 'sent' | 'done') {
  await db
    .update(schema.knowledgeTopics)
    .set({ status })
    .where(eq(schema.knowledgeTopics.id, id))
}

export async function deleteKnowledgeTopic(id: number) {
  await db.delete(schema.knowledgeTopics).where(eq(schema.knowledgeTopics.id, id))
}

// ─── CONSULTATION CLINICAL DATA ───────────────────────────────

export async function createConsultationClinicalData(data: typeof schema.consultationClinicalData.$inferInsert) {
  await db.insert(schema.consultationClinicalData).values(data)
}

// ─── ADMIN STATS HELPERS ──────────────────────────────────────

async function getClinicDoctorIds(clinicId: string): Promise<number[]> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.clinicId, clinicId), eq(schema.users.active, 1)))
  return rows.map((r) => r.id)
}

function summarizeClinicalRows(rows: ConsultationClinicalData[]) {
  if (!rows.length) return null

  const treatmentDist = { oral: 0, iv: 0, both: 0, none: 0 }
  rows.forEach((r) => {
    if (r.treatmentType) treatmentDist[r.treatmentType]++
  })

  const hospitalization = rows.filter((r) => r.hasHospitalizationIndication).length

  return {
    total: rows.length,
    treatmentDistribution: treatmentDist,
    hospitalizationCount: hospitalization,
    hospitalizationPercentage: Math.round((hospitalization / rows.length) * 100),
  }
}

export async function adminGetOverviewStats(clinicId: string) {
  const doctorIds = await getClinicDoctorIds(clinicId)
  if (!doctorIds.length) {
    return { totalConsultations: 0, today: 0, week: 0, month: 0, activeDoctors: 0, totalTopics: 0, avgPerDoctorPerDay: '0' }
  }

  const now        = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart  = new Date(now.getTime() - 7 * 86400000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [total]  = await db.select({ count: count() }).from(schema.consultations).where(inArray(schema.consultations.userId, doctorIds))
  const [today]  = await db.select({ count: count() }).from(schema.consultations).where(and(inArray(schema.consultations.userId, doctorIds), gte(schema.consultations.createdAt, todayStart)))
  const [week]   = await db.select({ count: count() }).from(schema.consultations).where(and(inArray(schema.consultations.userId, doctorIds), gte(schema.consultations.createdAt, weekStart)))
  const [month]  = await db.select({ count: count() }).from(schema.consultations).where(and(inArray(schema.consultations.userId, doctorIds), gte(schema.consultations.createdAt, monthStart)))
  const [topics] = await db.select({ count: count() }).from(schema.knowledgeTopics).where(eq(schema.knowledgeTopics.clinicId, clinicId))

  return {
    totalConsultations: total.count,
    today:              today.count,
    week:               week.count,
    month:              month.count,
    activeDoctors:      doctorIds.length,
    totalTopics:        topics.count,
    avgPerDoctorPerDay: doctorIds.length > 0
      ? (today.count / doctorIds.length).toFixed(1)
      : '0',
  }
}

export async function adminGetConsultationsByPeriod(clinicId: string, days = 30) {
  const doctorIds = await getClinicDoctorIds(clinicId)
  if (!doctorIds.length) return []

  const since = new Date(Date.now() - days * 86400000)

  return db
    .select({
      date:  sql<string>`DATE(${schema.consultations.createdAt})`,
      count: count(),
    })
    .from(schema.consultations)
    .where(and(inArray(schema.consultations.userId, doctorIds), gte(schema.consultations.createdAt, since)))
    .groupBy(sql`DATE(${schema.consultations.createdAt})`)
    .orderBy(sql`DATE(${schema.consultations.createdAt})`)
}

export async function adminGetDoctorRanking(clinicId: string) {
  const doctors = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, specialty: schema.users.specialty, crm: schema.users.crm })
    .from(schema.users)
    .where(and(eq(schema.users.clinicId, clinicId), eq(schema.users.active, 1)))

  if (!doctors.length) return []

  const doctorIds  = doctors.map((d) => d.id)
  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const rows = await db
    .select({
      userId:          schema.consultations.userId,
      total:           count(),
      monthCount:      sql<number>`SUM(CASE WHEN ${schema.consultations.createdAt} >= ${monthStart} THEN 1 ELSE 0 END)`,
      completed:       sql<number>`SUM(CASE WHEN ${schema.consultations.status} = 'completed' THEN 1 ELSE 0 END)`,
      avgQualityScore: avg(schema.consultations.qualityScore),
      lastConsultation: sql<string>`MAX(${schema.consultations.createdAt})`,
    })
    .from(schema.consultations)
    .where(inArray(schema.consultations.userId, doctorIds))
    .groupBy(schema.consultations.userId)
    .orderBy(desc(count()))

  const topicsByDoctor = await db
    .select({ sharedBy: schema.knowledgeTopics.sharedBy, count: count() })
    .from(schema.knowledgeTopics)
    .where(eq(schema.knowledgeTopics.clinicId, clinicId))
    .groupBy(schema.knowledgeTopics.sharedBy)

  const topicMap  = new Map(topicsByDoctor.map((t) => [t.sharedBy, t.count]))
  const doctorMap = new Map(doctors.map((d) => [d.id, d]))

  return rows.map((r) => ({
    ...r,
    ...doctorMap.get(r.userId),
    topicsGenerated: topicMap.get(r.userId) ?? 0,
    avgQualityScore: r.avgQualityScore ? Number(r.avgQualityScore).toFixed(1) : null,
  }))
}

export async function adminGetTopDiagnoses(clinicId: string, limit = 10) {
  const rows = await db
    .select({ topic: schema.knowledgeTopics.topic, count: count() })
    .from(schema.knowledgeTopics)
    .where(and(eq(schema.knowledgeTopics.clinicId, clinicId), eq(schema.knowledgeTopics.source, 'auto')))
    .groupBy(schema.knowledgeTopics.topic)
    .orderBy(desc(count()))
    .limit(limit)

  const total = rows.reduce((s, r) => s + r.count, 0)
  return rows.map((r) => ({
    ...r,
    percentage: total > 0 ? Math.round((r.count / total) * 100) : 0,
  }))
}

export async function adminGetPlatformMetrics(clinicId: string) {
  const doctorIds = await getClinicDoctorIds(clinicId)
  if (!doctorIds.length) {
    return { qualityDist: [], statusDist: [], totalAudioMinutes: 0, totalSoaps: 0, topicsThisMonth: 0 }
  }

  const qualityDist = await db
    .select({
      bucket: sql<string>`CASE WHEN ${schema.consultations.qualityScore} >= 8 THEN 'alto' WHEN ${schema.consultations.qualityScore} >= 6 THEN 'medio' WHEN ${schema.consultations.qualityScore} IS NOT NULL THEN 'baixo' ELSE 'sem_score' END`,
      count:  count(),
    })
    .from(schema.consultations)
    .where(inArray(schema.consultations.userId, doctorIds))
    .groupBy(sql`1`)

  const statusDist = await db
    .select({ status: schema.consultations.status, count: count() })
    .from(schema.consultations)
    .where(inArray(schema.consultations.userId, doctorIds))
    .groupBy(schema.consultations.status)

  const [audioStats] = await db
    .select({ totalMinutes: sql<number>`COALESCE(SUM(${schema.consultations.audioDuration}) / 60, 0)` })
    .from(schema.consultations)
    .where(inArray(schema.consultations.userId, doctorIds))

  const [soapCount] = await db
    .select({ count: count() })
    .from(schema.consultations)
    .where(and(inArray(schema.consultations.userId, doctorIds), isNotNull(schema.consultations.soapPlan)))

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const [topicsMonth] = await db
    .select({ count: count() })
    .from(schema.knowledgeTopics)
    .where(and(eq(schema.knowledgeTopics.clinicId, clinicId), gte(schema.knowledgeTopics.createdAt, monthStart)))

  return {
    qualityDist,
    statusDist,
    totalAudioMinutes: Math.round(audioStats?.totalMinutes ?? 0),
    totalSoaps:        soapCount.count,
    topicsThisMonth:   topicsMonth.count,
  }
}

export async function adminGetClinicalIndicators(clinicId: string) {
  const doctorIds = await getClinicDoctorIds(clinicId)
  if (!doctorIds.length) return null

  const rows = await db
    .select()
    .from(schema.consultationClinicalData)
    .where(inArray(schema.consultationClinicalData.doctorId, doctorIds))

  const total = rows.length
  if (!total) return null

  const withExams = rows.filter((r) => {
    try { return (JSON.parse(r.examsRequested ?? '[]') as unknown[]).length > 0 } catch { return false }
  }).length

  const treatmentDist = { oral: 0, iv: 0, both: 0, none: 0 }
  rows.forEach((r) => { if (r.treatmentType) treatmentDist[r.treatmentType]++ })

  const hospitalization = rows.filter((r) => r.hasHospitalizationIndication).length

  const followUpDays = rows.filter((r) => r.followUpDays != null).map((r) => r.followUpDays!)
  const avgFollowUp  = followUpDays.length
    ? (followUpDays.reduce((a, b) => a + b, 0) / followUpDays.length).toFixed(1)
    : null

  const examCount: Record<string, number> = {}
  const medCount:  Record<string, { count: number; routes: string[] }> = {}

  rows.forEach((r) => {
    try {
      (JSON.parse(r.examsRequested ?? '[]') as string[]).forEach((e) => {
        examCount[e] = (examCount[e] ?? 0) + 1
      })
    } catch {}
    try {
      (JSON.parse(r.medications ?? '[]') as { name: string; route: string }[]).forEach((m) => {
        if (!medCount[m.name]) medCount[m.name] = { count: 0, routes: [] }
        medCount[m.name].count++
        medCount[m.name].routes.push(m.route)
      })
    } catch {}
  })

  const topExams = Object.entries(examCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, c]) => ({ name, count: c, percentage: Math.round((c / total) * 100) }))

  const topMeds = Object.entries(medCount)
    .sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    .map(([name, data]) => {
      const route = data.routes.sort((a, b) =>
        data.routes.filter((r) => r === b).length - data.routes.filter((r) => r === a).length,
      )[0]
      return { name, count: data.count, predominantRoute: route }
    })

  return {
    total,
    withExamsPercentage:     Math.round((withExams / total) * 100),
    treatmentDistribution:   {
      oral: Math.round((treatmentDist.oral / total) * 100),
      iv:   Math.round((treatmentDist.iv   / total) * 100),
      both: Math.round((treatmentDist.both / total) * 100),
      none: Math.round((treatmentDist.none / total) * 100),
    },
    hospitalizationPercentage: Math.round((hospitalization / total) * 100),
    avgFollowUpDays:           avgFollowUp,
    topExams,
    topMeds,
  }
}

export async function adminGetDoctorProfile(clinicId: string, userId: number) {
  const [doctor] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, specialty: schema.users.specialty, crm: schema.users.crm, createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(and(eq(schema.users.id, userId), eq(schema.users.clinicId, clinicId)))
    .limit(1)

  if (!doctor) throw new Error('Médico não encontrado nesta clínica')

  const [stats] = await db
    .select({
      total:     count(),
      completed: sql<number>`SUM(CASE WHEN ${schema.consultations.status} = 'completed' THEN 1 ELSE 0 END)`,
      avgScore:  avg(schema.consultations.qualityScore),
      lastDate:  sql<string>`MAX(${schema.consultations.createdAt})`,
    })
    .from(schema.consultations)
    .where(eq(schema.consultations.userId, userId))

  const topDiagnoses = await db
    .select({ topic: schema.knowledgeTopics.topic, count: count() })
    .from(schema.knowledgeTopics)
    .where(and(eq(schema.knowledgeTopics.sharedBy, userId), eq(schema.knowledgeTopics.source, 'auto')))
    .groupBy(schema.knowledgeTopics.topic)
    .orderBy(desc(count()))
    .limit(10)

  const allDoctorIds = await getClinicDoctorIds(clinicId)
  const [clinicAvgScore] = allDoctorIds.length
    ? await db
        .select({ avg: avg(schema.consultations.qualityScore) })
        .from(schema.consultations)
        .where(inArray(schema.consultations.userId, allDoctorIds))
    : [{ avg: null }]

  const clinicalRows = await db
    .select()
    .from(schema.consultationClinicalData)
    .where(eq(schema.consultationClinicalData.doctorId, userId))

  return {
    doctor,
    stats:         { ...stats, avgScore: stats?.avgScore ? Number(stats.avgScore).toFixed(1) : null },
    clinicAvgScore: clinicAvgScore?.avg ? Number(clinicAvgScore.avg).toFixed(1) : null,
    topDiagnoses,
    clinicalData:   summarizeClinicalRows(clinicalRows),
  }
}
