"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGpsCheckin = createGpsCheckin;
exports.getAgentLastLocation = getAgentLastLocation;
const database_1 = require("../config/database");
const audit_service_1 = require("../services/audit.service");
const AppError_1 = require("../utils/AppError");
const app_1 = require("../app");
function auth(req) {
    return req.user;
}
function assertRole(req, roles) {
    const { role } = auth(req);
    if (!roles.includes(role)) {
        throw new AppError_1.AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
    }
}
async function createGpsCheckin(req, res, next) {
    try {
        const { userId, role } = auth(req);
        const { missionId, latitude, longitude, eventType = 'arrival' } = req.body;
        if (!missionId || latitude == null || longitude == null) {
            throw new AppError_1.AppError('missionId, latitude et longitude sont obligatoires', 400);
        }
        const result = await database_1.db.query('SELECT * FROM missions WHERE id = $1', [missionId]);
        const mission = result.rows[0];
        if (!mission)
            throw new AppError_1.AppError('Mission introuvable', 404);
        if (role === 'agent' && mission.agent_id !== userId) {
            throw new AppError_1.AppError('Cette mission ne vous est pas assignée', 403);
        }
        if (eventType === 'arrival') {
            if (mission.status !== 'planned') {
                throw new AppError_1.AppError('Impossible d\'effectuer un check-in sur une mission non planifiée', 400);
            }
            await database_1.db.query(`
        UPDATE missions
        SET status      = 'in_progress',
            started_at  = NOW(),
            checkin_lat = $1,
            checkin_lon = $2
        WHERE id = $3
      `, [latitude, longitude, missionId]);
            await audit_service_1.AuditService.log({
                userId,
                action: 'GPS_CHECKIN',
                resourceType: 'mission',
                resourceId: missionId,
                details: { latitude, longitude, eventType },
            });
            if (mission.manager_id) {
                app_1.io.to(`user:${mission.manager_id}`).emit('mission:started', {
                    missionId,
                    agentId: mission.agent_id,
                    latitude,
                    longitude,
                });
            }
            return res.json({ success: true, message: 'Check-in enregistré' });
        }
        if (eventType === 'departure') {
            if (mission.status !== 'in_progress') {
                throw new AppError_1.AppError('Impossible d\'effectuer un check-out sur une mission qui n\'est pas en cours', 400);
            }
            await database_1.db.query(`
        UPDATE missions
        SET checkout_lat = $1,
            checkout_lon = $2,
            status       = 'review',
            completed_at = NOW(),
            actual_end   = NOW()
        WHERE id = $3
      `, [latitude, longitude, missionId]);
            await audit_service_1.AuditService.log({
                userId,
                action: 'GPS_CHECKOUT',
                resourceType: 'mission',
                resourceId: missionId,
                details: { latitude, longitude, eventType },
            });
            if (mission.manager_id) {
                app_1.io.to(`user:${mission.manager_id}`).emit('mission:completed', {
                    missionId,
                    agentId: mission.agent_id,
                    latitude,
                    longitude,
                });
            }
            return res.json({ success: true, message: 'Check-out enregistré' });
        }
        throw new AppError_1.AppError('eventType invalide', 400);
    }
    catch (err) {
        next(err);
    }
}
async function getAgentLastLocation(req, res, next) {
    try {
        const { userId, role } = auth(req);
        const { id } = req.params;
        if (role === 'agent' && id !== userId) {
            throw new AppError_1.AppError('Accès refusé', 403);
        }
        // Préférer la position d'une mission en cours, sinon la dernière position connue.
        const active = await database_1.db.query('SELECT * FROM v_agent_locations WHERE agent_id = $1', [id]);
        if (active.rows.length > 0) {
            const row = active.rows[0];
            return res.json({
                success: true,
                data: {
                    agentId: row.agent_id,
                    fullName: `${row.first_name} ${row.last_name}`,
                    missionId: row.mission_id,
                    missionTitle: row.mission_title,
                    siteName: row.site_name,
                    latitude: row.agent_lat,
                    longitude: row.agent_lon,
                    recordedAt: row.checkin_time,
                    status: row.status,
                },
            });
        }
        const last = await database_1.db.query(`
      SELECT
        m.id AS mission_id,
        m.title AS mission_title,
        s.name AS site_name,
        m.checkin_lat AS latitude,
        m.checkin_lon AS longitude,
        m.started_at AS recorded_at
      FROM missions m
      JOIN sites s ON s.id = m.site_id
      WHERE m.agent_id = $1
        AND m.checkin_lat IS NOT NULL
      ORDER BY m.started_at DESC
      LIMIT 1
    `, [id]);
        if (last.rows.length === 0) {
            return res.json({ success: true, data: null });
        }
        const row = last.rows[0];
        res.json({
            success: true,
            data: {
                agentId: id,
                missionId: row.mission_id,
                missionTitle: row.mission_title,
                siteName: row.site_name,
                latitude: row.latitude,
                longitude: row.longitude,
                recordedAt: row.recorded_at,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=gps.controller.js.map