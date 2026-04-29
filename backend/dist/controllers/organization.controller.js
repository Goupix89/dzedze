"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyOrg = getMyOrg;
exports.listPlans = listPlans;
exports.upgradePlan = upgradePlan;
const database_1 = require("../config/database");
const AppError_1 = require("../utils/AppError");
const plans_1 = require("../config/plans");
const audit_service_1 = require("../services/audit.service");
// ── GET /org/me ───────────────────────────────────────────────
async function getMyOrg(req, res, next) {
    try {
        const user = req.user;
        const orgId = user.orgId;
        if (!orgId)
            throw new AppError_1.AppError('Organisation introuvable', 404);
        const [orgRes, usageRes, subRes] = await Promise.all([
            database_1.db.query('SELECT * FROM organizations WHERE id = $1', [orgId]),
            database_1.db.query('SELECT * FROM v_org_usage WHERE organization_id = $1', [orgId]),
            database_1.db.query(`SELECT * FROM subscriptions WHERE organization_id = $1
         ORDER BY created_at DESC LIMIT 5`, [orgId]),
        ]);
        const org = orgRes.rows[0];
        const usage = usageRes.rows[0];
        if (!org)
            throw new AppError_1.AppError('Organisation introuvable', 404);
        const plan = (0, plans_1.getPlan)(org.plan);
        res.json({
            success: true,
            data: {
                id: org.id,
                name: org.name,
                plan: org.plan,
                planName: plan.name,
                priceFcfa: plan.priceFcfa,
                features: org.features,
                platforms: org.platforms,
                agentLimit: org.agent_limit,
                siteLimit: org.site_limit,
                trialEndsAt: org.trial_ends_at,
                isActive: org.is_active,
                logoUrl: org.logo_url,
                usage: {
                    agentsUsed: parseInt(usage?.agents_used ?? '0'),
                    sitesUsed: parseInt(usage?.sites_used ?? '0'),
                    missionsThisMonth: parseInt(usage?.missions_this_month ?? '0'),
                },
                subscriptions: subRes.rows,
                createdAt: org.created_at,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ── GET /org/plans ────────────────────────────────────────────
async function listPlans(_req, res, next) {
    try {
        res.json({
            success: true,
            data: Object.values(plans_1.PLANS).map(p => ({
                id: p.id,
                name: p.name,
                priceFcfa: p.priceFcfa,
                agentLimit: p.agentLimit,
                siteLimit: p.siteLimit,
                features: p.features,
                platforms: p.platforms,
            })),
        });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /org/upgrade ─────────────────────────────────────────
async function upgradePlan(req, res, next) {
    try {
        const user = req.user;
        const orgId = user.orgId;
        if (!orgId)
            throw new AppError_1.AppError('Organisation introuvable', 404);
        const { plan, paymentRef } = req.body;
        if (!plans_1.PLANS[plan])
            throw new AppError_1.AppError('Plan invalide', 400);
        if (plan === 'trial')
            throw new AppError_1.AppError('Impossible de passer au plan essai', 400);
        const planConfig = (0, plans_1.getPlan)(plan);
        const orgRes = await database_1.db.query('SELECT plan FROM organizations WHERE id = $1', [orgId]);
        const currentPlan = orgRes.rows[0]?.plan;
        if (currentPlan === plan)
            throw new AppError_1.AppError('Vous êtes déjà sur ce plan', 409);
        // Update org
        await database_1.db.query(`UPDATE organizations
       SET plan = $1, agent_limit = $2, site_limit = $3,
           features = $4, platforms = $5, trial_ends_at = NULL, updated_at = NOW()
       WHERE id = $6`, [plan, planConfig.agentLimit, planConfig.siteLimit,
            planConfig.features, planConfig.platforms, orgId]);
        // Close previous subscription, open new one
        await database_1.db.query(`UPDATE subscriptions SET status = 'cancelled', ends_at = NOW()
       WHERE organization_id = $1 AND status IN ('trial','active')`, [orgId]);
        await database_1.db.query(`INSERT INTO subscriptions (organization_id, plan, price_fcfa, status, payment_ref)
       VALUES ($1, $2, $3, 'active', $4)`, [orgId, plan, planConfig.priceFcfa, paymentRef ?? null]);
        await audit_service_1.AuditService.log({
            userId: user.userId, action: 'PLAN_UPGRADED', resourceType: 'organization',
            resourceId: orgId, details: { from: currentPlan, to: plan, paymentRef },
        });
        res.json({
            success: true,
            message: `Abonnement mis à niveau vers ${planConfig.name}`,
            data: { plan, planName: planConfig.name, priceFcfa: planConfig.priceFcfa },
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=organization.controller.js.map