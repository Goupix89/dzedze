import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AppError } from '../utils/AppError';
import { getOrgContext } from './auth.middleware';

/**
 * Middleware: Validate that selected org exists and is active
 * 
 * Superadmin can select any org via X-Org-Id header
 * Regular users always have org from JWT
 * 
 * This middleware ensures the org actually exists in the database
 */
export async function validateOrgExists(req: Request, _res: Response, next: NextFunction) {
  try {
    const orgId = getOrgContext(req);
    
    // If no org context, skip validation (will be caught by requireOrgContext)
    if (!orgId) {
      return next();
    }

    // Verify org exists and is active
    const { rows } = await db.query(
      'SELECT id FROM organizations WHERE id = $1 AND is_active = true',
      [orgId]
    );

    if (!rows.length) {
      return next(new AppError('Organisation introuvable ou désactivée', 404));
    }

    next();
  } catch (err) {
    next(err);
  }
}
