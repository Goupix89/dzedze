import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthPayload {
  userId: string;
  role: 'superadmin' | 'admin' | 'manager' | 'agent';
  orgId?: string;
  plan?: string;
}

// ─── Org Context ──────────────────────────────────────────────
// Superadmin can scope to an org via X-Org-Id header.
// Other roles always use their own orgId from JWT.
export function getOrgContext(req: Request): string | null {
  const user = (req as any).user as AuthPayload;
  if (user.role === 'superadmin') {
    return (req.headers['x-org-id'] as string) || null;
  }
  return user.orgId ?? null;
}

// ─── Verify JWT ───────────────────────────────────────────────
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Token manquant ou invalide', 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expiré, veuillez vous reconnecter', 401));
    }
    next(new AppError('Token invalide', 401));
  }
}

// ─── Role Guard ───────────────────────────────────────────────
export function requireRole(...roles: AuthPayload['role'][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthPayload;
    // superadmin bypasses all role checks
    if (!user || (user.role !== 'superadmin' && !roles.includes(user.role))) {
      return next(new AppError(`Accès réservé aux rôles: ${roles.join(', ')}`, 403));
    }
    next();
  };
}

// ─── Superadmin Guard ─────────────────────────────────────────
export function requireSuperadmin(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  if (!user || user.role !== 'superadmin') {
    return next(new AppError('Accès réservé au superadmin', 403));
  }
  next();
}

// ─── Org Context Guard ────────────────────────────────────────
// Superadmin must have selected an org; regular users always have one from JWT
export function requireOrgContext(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user as AuthPayload;
  const orgId = getOrgContext(req);
  
  // Superadmin MUST have selected an org via X-Org-Id header
  if (user.role === 'superadmin' && !orgId) {
    return next(new AppError('Sélectionnez une organisation d\'abord (header X-Org-Id manquant)', 400));
  }
  
  // Regular users must always have an org
  if (user.role !== 'superadmin' && !orgId) {
    return next(new AppError('Organisation manquante', 401));
  }
  
  next();
}

// ─── Consent Guard ────────────────────────────────────────────
export async function requireConsent(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.consentGiven) {
    return next(new AppError('Consentement RGPD requis avant utilisation', 403));
  }
  next();
}
