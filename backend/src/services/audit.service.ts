import { db } from '../config/database';
import { logger } from '../utils/logger';
import { Request } from 'express';

interface AuditEntry {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  organizationId?: string;
}

export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    try {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.userId ?? null,
          entry.action,
          entry.resourceType,
          entry.resourceId ?? null,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.ipAddress ?? null,
          entry.userAgent ?? null,
          entry.organizationId ?? null,
        ]
      );
    } catch (err) {
      logger.error('Failed to write audit log:', err);
    }
  }

  // ─── Log Superadmin Access ────────────────────────────────────
  static async logSuperadminAccess(req: Request, orgId: string | null) {
    const user = (req as any).user;
    if (user?.role === 'superadmin') {
      await this.log({
        userId: user.userId,
        action: orgId ? 'SUPERADMIN_ORG_SELECTED' : 'SUPERADMIN_NO_ORG',
        resourceType: 'superadmin_access',
        details: { method: req.method, path: req.path, orgId },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
        organizationId: orgId ?? undefined,
      });
    }
  }
}
