import { db } from '../db.ts'
import { auditLog } from '../../drizzle/schema.ts'
import { logger } from './logger.ts'

export type AuditAction =
  | 'paciente.read'
  | 'paciente.update'
  | 'paciente.export'
  | 'paciente.anonymize_request'
  | 'exame.read'
  | 'exame.upload'
  | 'exame.approve'
  | 'exame.reject'
  | 'pdf.generate'
  | 'pdf.download'
  | 'token.create'
  | 'token.revoke'
  | 'user.login'
  | 'user.logout'
  | 'user.2fa_setup'
  | 'user.2fa_verify'
  | 'user.2fa_disabled'
  | 'admin.user_role_change'
  | 'admin.user_deactivate'
  | 'admin.user_delete'
  | 'admin.user_restore'

interface AuditEntry {
  actorId?: number
  actorRole?: string
  action: AuditAction
  resourceType: string
  resourceId?: number
  detalhes?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      detalhes: entry.detalhes ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    })
  } catch (err) {
    // Audit failure must never crash the main flow — log and continue
    logger.error('[audit] falha ao gravar audit log', { error: String(err), action: entry.action })
  }
}
