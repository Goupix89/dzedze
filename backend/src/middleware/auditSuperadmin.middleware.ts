import { Request, Response, NextFunction } from 'express';
import { getOrgContext } from './auth.middleware';
import { AuditService } from '../services/audit.service';

/**
 * Middleware: Log all superadmin access attempts
 * 
 * Tracks when superadmin accesses different organizations
 * Non-blocking: audit log failures don't interrupt the request
 */
export async function auditSuperadminContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  
  if (user?.role === 'superadmin') {
    const orgId = getOrgContext(req);
    
    // Log asynchronously (non-blocking)
    AuditService.logSuperadminAccess(req, orgId).catch(err => 
      console.error('Audit log failed:', err)
    );
  }
  
  next();
}
