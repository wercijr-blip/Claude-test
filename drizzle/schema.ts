import {
  mysqlTable,
  mysqlEnum,
  int,
  varchar,
  text,
  datetime,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core'

// ── Usuários (admin | doctor) ────────────────────────────────────

export const users = mysqlTable('users', {
  id:                     int('id').primaryKey().autoincrement(),
  email:                  varchar('email', { length: 320 }).notNull().unique(),
  passwordHash:           varchar('passwordHash', { length: 255 }),
  name:                   varchar('name', { length: 255 }),
  role:                   mysqlEnum('role', ['admin', 'doctor']).default('doctor').notNull(),
  clinicId:               varchar('clinicId', { length: 21 }),
  specialty:              varchar('specialty', { length: 100 }),
  crm:                    varchar('crm', { length: 30 }),
  active:                 int('active').default(1).notNull(),
  mustChangePassword:     int('mustChangePassword').default(1).notNull(),
  bulletinEmail:          varchar('bulletinEmail', { length: 320 }),
  receiveMonthlyBulletin: int('receiveMonthlyBulletin').default(1).notNull(),
  createdAt:              timestamp('createdAt').defaultNow().notNull(),
  updatedAt:              timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  emailIdx:  uniqueIndex('idx_users_email').on(t.email),
  clinicIdx: index('idx_users_clinic').on(t.clinicId),
  roleIdx:   index('idx_users_role').on(t.role),
}))

// ── Consultas médicas ─────────────────────────────────────────

export const consultations = mysqlTable('consultations', {
  id:             int('id').primaryKey().autoincrement(),
  userId:         int('userId').notNull(),
  patientName:    varchar('patientName', { length: 255 }),
  patientAge:     int('patientAge'),
  chiefComplaint: text('chiefComplaint'),
  audioUrl:       varchar('audioUrl', { length: 1000 }),
  audioDuration:  int('audioDuration'),
  transcription:  text('transcription'),
  soapSubjective: text('soapSubjective'),
  soapObjective:  text('soapObjective'),
  soapAssessment: text('soapAssessment'),
  soapPlan:       text('soapPlan'),
  qualityScore:   int('qualityScore'),
  status:         varchar('status', { length: 50 }).notNull().default('draft'),
  exportedAt:     datetime('exportedAt'),
  createdAt:      timestamp('createdAt').defaultNow().notNull(),
  updatedAt:      timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx:    index('idx_consultations_user').on(t.userId),
  statusIdx:  index('idx_consultations_status').on(t.status),
  createdIdx: index('idx_consultations_created').on(t.createdAt),
}))

// ── Tópicos de conhecimento ─────────────────────────────────────

export const knowledgeTopics = mysqlTable('knowledge_topics', {
  id:                int('id').primaryKey().autoincrement(),
  topic:             varchar('topic', { length: 500 }).notNull(),
  pubmedQuery:       text('pubmedQuery'),
  source:            mysqlEnum('source', ['auto', 'manual']).default('auto').notNull(),
  status:            mysqlEnum('status', ['pending', 'sent', 'done']).default('pending').notNull(),
  consultationId:    int('consultationId'),
  clinicId:          varchar('clinicId', { length: 21 }),
  visibility:        mysqlEnum('visibility', ['clinic']).default('clinic').notNull(),
  sharedBy:          int('sharedBy'),
  medicalSpecialty:  varchar('medicalSpecialty', { length: 100 }),
  specialtyCategory: varchar('specialtyCategory', { length: 50 }),
  subtopics:         text('subtopics'),
  createdAt:         timestamp('createdAt').defaultNow().notNull(),
  updatedAt:         timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  clinicIdx:   index('idx_kt_clinic').on(t.clinicId),
  statusIdx:   index('idx_kt_status').on(t.status),
  sharedByIdx: index('idx_kt_shared_by').on(t.sharedBy),
}))

// ── Dados clínicos extraídos ───────────────────────────────────────

export const consultationClinicalData = mysqlTable('consultation_clinical_data', {
  id:                           varchar('id', { length: 21 }).primaryKey(),
  consultationId:               int('consultation_id').notNull(),
  doctorId:                     int('doctor_id').notNull(),
  clinicId:                     varchar('clinic_id', { length: 21 }),
  examsRequested:               text('exams_requested'),
  treatmentType:                mysqlEnum('treatment_type', ['oral', 'iv', 'both', 'none']),
  medications:                  text('medications'),
  hasHospitalizationIndication: int('has_hospitalization_indication'),
  followUpDays:                 int('follow_up_days'),
  createdAt:                    timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  consultationIdx: index('idx_ccd_consultation').on(t.consultationId),
  doctorIdx:       index('idx_ccd_doctor').on(t.doctorId),
  clinicIdx:       index('idx_ccd_clinic').on(t.clinicId),
}))

export type ConsultationClinicalData = typeof consultationClinicalData.$inferSelect
export type InsertConsultationClinicalData = typeof consultationClinicalData.$inferInsert

// ── Histórico de boletins ───────────────────────────────────────

export const bulletinHistory = mysqlTable('bulletin_history', {
  id:           int('id').primaryKey().autoincrement(),
  clinicId:     varchar('clinicId', { length: 21 }).notNull(),
  month:        varchar('month', { length: 7 }).notNull(),
  doctorCount:  int('doctorCount').notNull().default(0),
  articleCount: int('articleCount').notNull().default(0),
  sentBy:       int('sentBy').notNull(),
  resentAt:     datetime('resentAt'),
  createdAt:    timestamp('createdAt').defaultNow().notNull(),
}, (t) => ({
  clinicIdx: index('idx_bh_clinic').on(t.clinicId),
  monthIdx:  index('idx_bh_month').on(t.month),
}))
