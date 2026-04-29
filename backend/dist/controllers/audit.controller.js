"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogs = listAuditLogs;
exports.getAuditStats = getAuditStats;
const database_1 = require("../config/database");
// ── GET /audit ────────────────────────────────────────────────
async function listAuditLogs(req, res, next) {
    try {
        const { user_id, action, resource_type, resource_id, from, to, page = '1', limit = '50', } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;
        const conditions = [];
        const params = [];
        let p = 1;
        if (user_id) {
            conditions.push(`al.user_id = $${p++}`);
            params.push(user_id);
        }
        if (action) {
            conditions.push(`al.action ILIKE $${p++}`);
            params.push(`%${action}%`);
        }
        if (resource_type) {
            conditions.push(`al.resource_type = $${p++}`);
            params.push(resource_type);
        }
        if (resource_id) {
            conditions.push(`al.resource_id = $${p++}`);
            params.push(resource_id);
        }
        if (from) {
            conditions.push(`al.created_at >= $${p++}`);
            params.push(from);
        }
        if (to) {
            conditions.push(`al.created_at <= $${p++}`);
            params.push(to);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [dataRes, countRes] = await Promise.all([
            database_1.db.query(`SELECT al.id, al.action, al.resource_type, al.resource_id,
                al.details, al.ip_address, al.user_agent, al.created_at,
                u.first_name, u.last_name, u.role
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT $${p} OFFSET $${p + 1}`, [...params, limitNum, offset]),
            database_1.db.query(`SELECT COUNT(*) FROM audit_logs al ${where}`, params),
        ]);
        res.json({
            success: true,
            data: dataRes.rows,
            pagination: {
                total: parseInt(countRes.rows[0].count),
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(parseInt(countRes.rows[0].count) / limitNum),
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ── GET /audit/stats ──────────────────────────────────────────
async function getAuditStats(req, res, next) {
    try {
        const { days = '7' } = req.query;
        const daysNum = Math.min(90, Math.max(1, parseInt(days)));
        const [actionsRes, usersRes, resourcesRes] = await Promise.all([
            database_1.db.query(`SELECT action, COUNT(*) as count
         FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '${daysNum} days'
         GROUP BY action ORDER BY count DESC LIMIT 10`),
            database_1.db.query(`SELECT u.first_name, u.last_name, u.role, COUNT(*) as actions
         FROM audit_logs al
         JOIN users u ON al.user_id = u.id
         WHERE al.created_at > NOW() - INTERVAL '${daysNum} days'
         GROUP BY u.id, u.first_name, u.last_name, u.role
         ORDER BY actions DESC LIMIT 5`),
            database_1.db.query(`SELECT resource_type, COUNT(*) as count
         FROM audit_logs
         WHERE created_at > NOW() - INTERVAL '${daysNum} days'
         GROUP BY resource_type ORDER BY count DESC`),
        ]);
        res.json({
            success: true,
            data: {
                topActions: actionsRes.rows,
                topUsers: usersRes.rows,
                byResource: resourcesRes.rows,
                periodDays: daysNum,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=audit.controller.js.map