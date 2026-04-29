"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSites = listSites;
exports.createSite = createSite;
exports.getSite = getSite;
exports.updateSite = updateSite;
exports.deleteSite = deleteSite;
const database_1 = require("../config/database");
const audit_service_1 = require("../services/audit.service");
const AppError_1 = require("../utils/AppError");
function auth(req) { return req.user; }
function assertRole(req, roles) {
    if (!roles.includes(auth(req).role))
        throw new AppError_1.AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
}
// GET /sites
async function listSites(req, res, next) {
    try {
        const { search, site_type, active = 'true', limit = '50', offset = '0' } = req.query;
        let q = `
      SELECT s.*,
             u.first_name || ' ' || u.last_name AS manager_name,
             COUNT(m.id) FILTER (WHERE m.status NOT IN ('cancelled','completed')) AS active_missions
      FROM sites s
      LEFT JOIN users u ON u.id = s.manager_id
      LEFT JOIN missions m ON m.site_id = s.id
      WHERE 1=1
    `;
        const params = [];
        let p = 1;
        if (active !== 'all') {
            q += ` AND s.is_active = $${p++}`;
            params.push(active === 'true');
        }
        if (site_type) {
            q += ` AND s.site_type = $${p++}`;
            params.push(site_type);
        }
        if (search) {
            q += ` AND (s.name ILIKE $${p} OR s.city ILIKE $${p})`;
            params.push(`%${search}%`);
            p++;
        }
        q += ` GROUP BY s.id, u.first_name, u.last_name ORDER BY s.name LIMIT $${p++} OFFSET $${p++}`;
        params.push(parseInt(limit), parseInt(offset));
        const { rows } = await database_1.db.query(q, params);
        res.json({ success: true, data: rows });
    }
    catch (e) {
        next(e);
    }
}
// POST /sites
async function createSite(req, res, next) {
    try {
        assertRole(req, ['admin', 'manager']);
        const { name, address, city, country = 'France', latitude, longitude, description, surface_m2, site_type = 'bureau', checklist_template = [], manager_id, } = req.body;
        if (!name || !address || !city)
            throw new AppError_1.AppError('name, address et city sont requis', 400);
        const { rows } = await database_1.db.query(`
      INSERT INTO sites (name, address, city, country, latitude, longitude, description,
                         surface_m2, site_type, checklist_template, manager_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [name, address, city, country, latitude || null, longitude || null, description || null,
            surface_m2 || null, site_type, JSON.stringify(checklist_template), manager_id || null]);
        await audit_service_1.AuditService.log({
            userId: auth(req).userId, action: 'site_created',
            resourceType: 'site', resourceId: rows[0].id,
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        res.status(201).json({ success: true, data: rows[0] });
    }
    catch (e) {
        next(e);
    }
}
// GET /sites/:id
async function getSite(req, res, next) {
    try {
        const { rows } = await database_1.db.query(`
      SELECT s.*,
             u.first_name || ' ' || u.last_name AS manager_name,
             json_agg(json_build_object(
               'id', m.id, 'title', m.title, 'status', m.status,
               'scheduled_start', m.scheduled_start
             ) ORDER BY m.scheduled_start DESC) FILTER (WHERE m.id IS NOT NULL) AS recent_missions
      FROM sites s
      LEFT JOIN users u ON u.id = s.manager_id
      LEFT JOIN missions m ON m.site_id = s.id
      WHERE s.id = $1
      GROUP BY s.id, u.first_name, u.last_name
    `, [req.params.id]);
        if (!rows.length)
            throw new AppError_1.AppError('Site introuvable', 404);
        res.json({ success: true, data: rows[0] });
    }
    catch (e) {
        next(e);
    }
}
// PUT /sites/:id
async function updateSite(req, res, next) {
    try {
        assertRole(req, ['admin', 'manager']);
        const { name, address, city, country, latitude, longitude, description, surface_m2, site_type, checklist_template, manager_id, is_active, } = req.body;
        const { rows } = await database_1.db.query(`
      UPDATE sites SET
        name               = COALESCE($1,  name),
        address            = COALESCE($2,  address),
        city               = COALESCE($3,  city),
        country            = COALESCE($4,  country),
        latitude           = COALESCE($5,  latitude),
        longitude          = COALESCE($6,  longitude),
        description        = COALESCE($7,  description),
        surface_m2         = COALESCE($8,  surface_m2),
        site_type          = COALESCE($9,  site_type),
        checklist_template = COALESCE($10, checklist_template),
        manager_id         = COALESCE($11, manager_id),
        is_active          = COALESCE($12, is_active),
        updated_at         = NOW()
      WHERE id = $13
      RETURNING *
    `, [name, address, city, country, latitude, longitude, description,
            surface_m2, site_type,
            checklist_template ? JSON.stringify(checklist_template) : null,
            manager_id, is_active, req.params.id]);
        if (!rows.length)
            throw new AppError_1.AppError('Site introuvable', 404);
        await audit_service_1.AuditService.log({
            userId: auth(req).userId, action: 'site_updated',
            resourceType: 'site', resourceId: rows[0].id,
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        res.json({ success: true, data: rows[0] });
    }
    catch (e) {
        next(e);
    }
}
// DELETE /sites/:id  (soft delete)
async function deleteSite(req, res, next) {
    try {
        assertRole(req, ['admin']);
        const { rows } = await database_1.db.query(`UPDATE sites SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length)
            throw new AppError_1.AppError('Site introuvable', 404);
        await audit_service_1.AuditService.log({
            userId: auth(req).userId, action: 'site_deleted',
            resourceType: 'site', resourceId: req.params.id,
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        res.json({ success: true, message: 'Site désactivé' });
    }
    catch (e) {
        next(e);
    }
}
//# sourceMappingURL=site.controller.js.map