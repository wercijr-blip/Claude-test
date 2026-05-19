import { logger } from "./logger.ts";
import { db } from "../db.ts";
import { auditLog } from "../../drizzle/cis-schema.ts";

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "session.open"
  | "session.close"
  | "soap.create"
  | "soap.read"
  | "soap.export"
  | "alert.view"
  | "alert.feedback"
  | "alert.suppress"
  | "draft.create"
  | "draft.read"
  | "digest.generate"
  | "admin.role_change"
  | "admin.user_deactivate"
  | "admin.user_delete"
  | "data.portability_request"
  | "data.export";

export interface AuditEntry {
  actorId?: number;
  actorRole?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: number;
  detalhes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export function logAudit(entry: AuditEntry): void {
  logger.info("[audit]", {
    actor: entry.actorId,
    role: entry.actorRole,
    action: entry.action,
    resource: entry.resourceType,
    resourceId: entry.resourceId,
    ip: entry.ipAddress,
    ...entry.detalhes,
  });

  // Persist to DB — fire-and-forget; never block the request path
  db.insert(auditLog)
    .values({
      actorId: entry.actorId ?? null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ?? null,
      detalhes: entry.detalhes ?? null,
      ipAddress: entry.ipAddress ?? null,
    })
    .catch((err) => {
      logger.error("[audit] falha ao persistir no banco", {
        error: String(err),
        action: entry.action,
      });
    });
}
