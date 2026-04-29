import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { Feature, getPlan } from '../config/plans';
import { AppError } from '../utils/AppError';

// ── requireFeature ────────────────────────────────────────────
// Usage: router.get('/ai/report', requireFeature('ai_analysis'), handler)
export function requireFeature(feature: Feature) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.orgId) return next(new AppError('Organisation introuvable', 403));

      const plan = getPlan(user.plan);
      if (!plan.features.includes(feature)) {
        return next(new AppError(
          `La fonctionnalité "${feature}" n'est pas incluse dans votre abonnement ${plan.name}. Passez à un plan supérieur.`,
          402
        ));
      }
      next();
    } catch (err) { next(err); }
  };
}

// ── checkQuota ────────────────────────────────────────────────
// Usage: router.post('/users', checkQuota('agents'), handler)
export function checkQuota(resource: 'agents' | 'sites') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.orgId) return next(new AppError('Organisation introuvable', 403));

      const plan = getPlan(user.plan);
      const limit = resource === 'agents' ? plan.agentLimit : plan.siteLimit;
      if (limit === -1) return next(); // illimité

      const col   = resource === 'agents' ? "role = 'agent' AND is_active" : 'is_active';
      const table = resource === 'agents' ? 'users' : 'sites';
      const res = await db.query(
        `SELECT COUNT(*) FROM ${table} WHERE organization_id = $1 AND ${col}`,
        [user.orgId]
      );
      const current = parseInt(res.rows[0].count);

      if (current >= limit) {
        return next(new AppError(
          `Quota atteint : votre plan ${getPlan(user.plan).name} permet ${limit} ${resource}. Passez à un plan supérieur.`,
          402
        ));
      }
      next();
    } catch (err) { next(err); }
  };
}

// ── loadOrgContext ────────────────────────────────────────────
// Injects org info into req.user after authenticate()
// Use on routes that need org data but don't use JWT org fields
export async function loadOrgContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    if (!user || user.orgId) return next(); // already populated from JWT

    const res = await db.query(
      'SELECT organization_id, plan FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.id = $1',
      [user.userId]
    );
    if (res.rows[0]) {
      user.orgId = res.rows[0].organization_id;
      user.plan  = res.rows[0].plan;
    }
    next();
  } catch (err) { next(err); }
}
