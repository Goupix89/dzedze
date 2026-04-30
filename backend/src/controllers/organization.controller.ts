import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AppError } from '../utils/AppError';
import { getPlan, PLANS, PlanId } from '../config/plans';
import { AuditService } from '../services/audit.service';

// ── GET /org/me ───────────────────────────────────────────────
export async function getMyOrg(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;
    const orgId = user.orgId;
    if (!orgId) throw new AppError('Organisation introuvable', 404);

    const [orgRes, usageRes, subRes] = await Promise.all([
      db.query('SELECT * FROM organizations WHERE id = $1', [orgId]),
      db.query('SELECT * FROM v_org_usage WHERE organization_id = $1', [orgId]),
      db.query(
        `SELECT * FROM subscriptions WHERE organization_id = $1
         ORDER BY created_at DESC LIMIT 5`,
        [orgId]
      ),
    ]);

    const org   = orgRes.rows[0];
    const usage = usageRes.rows[0];
    if (!org) throw new AppError('Organisation introuvable', 404);

    const plan = getPlan(org.plan as PlanId);

    res.json({
      success: true,
      data: {
        id:          org.id,
        name:        org.name,
        plan:        org.plan,
        planName:    plan.name,
        priceFcfa:   plan.priceFcfa,
        features:    org.features,
        platforms:   org.platforms,
        agentLimit:  org.agent_limit,
        siteLimit:   org.site_limit,
        trialEndsAt: org.trial_ends_at,
        isActive:    org.is_active,
        logoUrl:     org.logo_url,
        usage: {
          agentsUsed:       parseInt(usage?.agents_used ?? '0'),
          sitesUsed:        parseInt(usage?.sites_used  ?? '0'),
          missionsThisMonth: parseInt(usage?.missions_this_month ?? '0'),
        },
        subscriptions: subRes.rows,
        createdAt:   org.created_at,
      },
    });
  } catch (err) { next(err); }
}

// ── GET /org/plans ────────────────────────────────────────────
export async function listPlans(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: Object.values(PLANS).map(p => ({
        id:         p.id,
        name:       p.name,
        priceFcfa:  p.priceFcfa,
        agentLimit: p.agentLimit,
        siteLimit:  p.siteLimit,
        features:   p.features,
        platforms:  p.platforms,
      })),
    });
  } catch (err) { next(err); }
}

// ── POST /org/upgrade ─────────────────────────────────────────
export async function upgradePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const user  = (req as any).user;
    const orgId = user.orgId;
    if (!orgId) throw new AppError('Organisation introuvable', 404);

    const { plan, paymentRef } = req.body as { plan: PlanId; paymentRef?: string };
    if (!PLANS[plan]) throw new AppError('Plan invalide', 400);
    if (plan === 'trial') throw new AppError('Impossible de passer au plan essai', 400);

    const planConfig = getPlan(plan);
    const orgRes = await db.query('SELECT plan FROM organizations WHERE id = $1', [orgId]);
    const currentPlan = orgRes.rows[0]?.plan;

    if (currentPlan === plan) throw new AppError('Vous êtes déjà sur ce plan', 409);

    // Update org
    await db.query(
      `UPDATE organizations
       SET plan = $1, agent_limit = $2, site_limit = $3,
           features = $4, platforms = $5, trial_ends_at = NULL, updated_at = NOW()
       WHERE id = $6`,
      [plan, planConfig.agentLimit, planConfig.siteLimit,
       planConfig.features, planConfig.platforms, orgId]
    );

    // Close previous subscription, open new one
    await db.query(
      `UPDATE subscriptions SET status = 'cancelled', ends_at = NOW()
       WHERE organization_id = $1 AND status IN ('trial','active')`,
      [orgId]
    );
    await db.query(
      `INSERT INTO subscriptions (organization_id, plan, price_fcfa, status, payment_ref)
       VALUES ($1, $2, $3, 'active', $4)`,
      [orgId, plan, planConfig.priceFcfa, paymentRef ?? null]
    );

    await AuditService.log({
      userId: user.userId, action: 'PLAN_UPGRADED', resourceType: 'organization',
      resourceId: orgId, details: { from: currentPlan, to: plan, paymentRef },
    });

    res.json({
      success: true,
      message: `Abonnement mis à niveau vers ${planConfig.name}`,
      data: { plan, planName: planConfig.name, priceFcfa: planConfig.priceFcfa },
    });
  } catch (err) { next(err); }
}


// ── GET /org/all ─────────────────────────────────── superadmin
export async function listAllOrganizations(_req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await db.query(`
      SELECT
        o.id, o.name, o.plan, o.is_active,
        o.created_at, o.trial_ends_at,
        o.agent_limit, o.site_limit,
        u.email AS owner_email,
        u.first_name || ' ' || u.last_name AS owner_name,
        (SELECT COUNT(*) FROM users    WHERE organization_id = o.id) AS users_count,
        (SELECT COUNT(*) FROM missions WHERE organization_id = o.id) AS missions_count,
        (SELECT COUNT(*) FROM missions WHERE organization_id = o.id AND status = 'in_progress') AS active_missions,
        s.status AS sub_status, s.ends_at AS sub_ends_at
      FROM organizations o
      LEFT JOIN users u ON u.id = o.owner_id
      LEFT JOIN subscriptions s ON s.organization_id = o.id
        AND s.status NOT IN ('cancelled','expired')
      ORDER BY o.created_at DESC
    `);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ── POST /org/validate-selection ───────────────────────────────
export async function validateOrgSelection(req: Request, res: Response, next: NextFunction) {
  try {
    const { orgId } = req.body;
    if (!orgId) throw new AppError('orgId requis', 400);

    const { rows } = await db.query(
      'SELECT id, name FROM organizations WHERE id = $1 AND is_active = true',
      [orgId]
    );

    if (!rows.length) throw new AppError('Organisation introuvable', 404);

    res.json({
      success: true,
      data: { id: rows[0].id, name: rows[0].name },
    });
  } catch (err) { next(err); }
}
