"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireFeature = requireFeature;
exports.checkQuota = checkQuota;
exports.loadOrgContext = loadOrgContext;
const database_1 = require("../config/database");
const plans_1 = require("../config/plans");
const AppError_1 = require("../utils/AppError");
// ── requireFeature ────────────────────────────────────────────
// Usage: router.get('/ai/report', requireFeature('ai_analysis'), handler)
function requireFeature(feature) {
    return async (req, _res, next) => {
        try {
            const user = req.user;
            if (!user?.orgId)
                return next(new AppError_1.AppError('Organisation introuvable', 403));
            const plan = (0, plans_1.getPlan)(user.plan);
            if (!plan.features.includes(feature)) {
                return next(new AppError_1.AppError(`La fonctionnalité "${feature}" n'est pas incluse dans votre abonnement ${plan.name}. Passez à un plan supérieur.`, 402));
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── checkQuota ────────────────────────────────────────────────
// Usage: router.post('/users', checkQuota('agents'), handler)
function checkQuota(resource) {
    return async (req, _res, next) => {
        try {
            const user = req.user;
            if (!user?.orgId)
                return next(new AppError_1.AppError('Organisation introuvable', 403));
            const plan = (0, plans_1.getPlan)(user.plan);
            const limit = resource === 'agents' ? plan.agentLimit : plan.siteLimit;
            if (limit === -1)
                return next(); // illimité
            const col = resource === 'agents' ? "role = 'agent' AND is_active" : 'is_active';
            const table = resource === 'agents' ? 'users' : 'sites';
            const res = await database_1.db.query(`SELECT COUNT(*) FROM ${table} WHERE organization_id = $1 AND ${col}`, [user.orgId]);
            const current = parseInt(res.rows[0].count);
            if (current >= limit) {
                return next(new AppError_1.AppError(`Quota atteint : votre plan ${(0, plans_1.getPlan)(user.plan).name} permet ${limit} ${resource}. Passez à un plan supérieur.`, 402));
            }
            next();
        }
        catch (err) {
            next(err);
        }
    };
}
// ── loadOrgContext ────────────────────────────────────────────
// Injects org info into req.user after authenticate()
// Use on routes that need org data but don't use JWT org fields
async function loadOrgContext(req, _res, next) {
    try {
        const user = req.user;
        if (!user || user.orgId)
            return next(); // already populated from JWT
        const res = await database_1.db.query('SELECT organization_id, plan FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.id = $1', [user.userId]);
        if (res.rows[0]) {
            user.orgId = res.rows[0].organization_id;
            user.plan = res.rows[0].plan;
        }
        next();
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=subscription.middleware.js.map