import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthPayload {
  userId: string;
  role: 'admin' | 'manager' | 'agent';
  orgId?: string;
  plan?: string;
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
    if (!user || !roles.includes(user.role)) {
      return next(new AppError(`Accès réservé aux rôles: ${roles.join(', ')}`, 403));
    }
    next();
  };
}

// ─── Consent Guard ────────────────────────────────────────────
export async function requireConsent(req: Request, _res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.consentGiven) {
    return next(new AppError('Consentement RGPD requis avant utilisation', 403));
  }
  next();
}
