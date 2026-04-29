"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitMissionRating = submitMissionRating;
exports.getAgentRatings = getAgentRatings;
const database_1 = require("../config/database");
const audit_service_1 = require("../services/audit.service");
const AppError_1 = require("../utils/AppError");
function auth(req) {
    return req.user;
}
function assertRole(req, roles) {
    if (!roles.includes(auth(req).role)) {
        throw new AppError_1.AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
    }
}
async function submitMissionRating(req, res, next) {
    try {
        assertRole(req, ['admin', 'manager']);
        const { userId } = auth(req);
        const { id } = req.params;
        const { score, comment } = req.body;
        if (score == null || score < 1 || score > 5) {
            throw new AppError_1.AppError('Score invalide : 1 à 5', 400);
        }
        const result = await database_1.db.query('SELECT * FROM missions WHERE id = $1', [id]);
        const mission = result.rows[0];
        if (!mission)
            throw new AppError_1.AppError('Mission introuvable', 404);
        if (!['in_progress', 'review'].includes(mission.status)) {
            throw new AppError_1.AppError('La mission doit être en cours ou en revue pour être notée', 400);
        }
        await database_1.db.query(`
      UPDATE missions
      SET status        = 'completed',
          quality_score = $1,
          notes         = COALESCE($2, notes)
      WHERE id = $3
    `, [score, comment ?? null, id]);
        await database_1.db.query('SELECT fn_update_agent_quality_score($1)', [mission.agent_id]);
        await audit_service_1.AuditService.log({
            userId,
            action: 'MISSION_RATED',
            resourceType: 'mission',
            resourceId: id,
            details: { score, comment },
        });
        res.json({ success: true, message: 'Note enregistrée', data: { score } });
    }
    catch (err) {
        next(err);
    }
}
async function getAgentRatings(req, res, next) {
    try {
        const { userId, role } = auth(req);
        const { id } = req.params;
        if (role === 'agent' && id !== userId) {
            throw new AppError_1.AppError('Accès refusé', 403);
        }
        const result = await database_1.db.query(`
      SELECT
        m.id AS mission_id,
        m.title,
        m.scheduled_start,
        m.completed_at,
        m.quality_score AS score,
        m.notes AS feedback,
        u.first_name || ' ' || u.last_name AS manager_name
      FROM missions m
      LEFT JOIN users u ON u.id = m.manager_id
      WHERE m.agent_id = $1
        AND m.quality_score IS NOT NULL
      ORDER BY m.completed_at DESC
      LIMIT 50
    `, [id]);
        res.json({ success: true, data: result.rows });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=rating.controller.js.map