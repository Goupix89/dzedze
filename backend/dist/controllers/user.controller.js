"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = listUsers;
exports.getMe = getMe;
exports.getUser = getUser;
exports.updateUser = updateUser;
exports.changePassword = changePassword;
exports.deleteUser = deleteUser;
exports.listAvailableAgents = listAvailableAgents;
const database_1 = require("../config/database");
const audit_service_1 = require("../services/audit.service");
const AppError_1 = require("../utils/AppError");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
function auth(req) { return req.user; }
function assertRole(req, roles) {
    if (!roles.includes(auth(req).role))
        throw new AppError_1.AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
}
const PUBLIC_COLS = `
  id, email, first_name, last_name, role, phone, avatar_url,
  status, is_active, quality_score, consent_given, last_login,
  id_card_number, birth_date, birth_place, home_address, blood_type,
  emergency_contact_name, emergency_contact_phone,
  contract_type, hire_date, specialties, uniform_size, shoe_size, notes,
  created_at, updated_at
`;
// GET /users
async function listUsers(req, res, next) {
    try {
        assertRole(req, ['admin', 'manager']);
        const { role, status, search, limit = '50', offset = '0' } = req.query;
        let q = `SELECT ${PUBLIC_COLS},
               (SELECT COUNT(*) FROM missions WHERE agent_id = u.id AND status = 'completed') AS missions_completed,
               (SELECT COUNT(*) FROM missions WHERE agent_id = u.id AND status = 'in_progress') AS missions_active
             FROM users u WHERE 1=1`;
        const params = [];
        let p = 1;
        if (role) {
            q += ` AND u.role = $${p++}`;
            params.push(role);
        }
        if (status) {
            q += ` AND u.status = $${p++}`;
            params.push(status);
        }
        if (search) {
            q += ` AND (u.first_name ILIKE $${p} OR u.last_name ILIKE $${p} OR u.email ILIKE $${p})`;
            params.push(`%${search}%`);
            p++;
        }
        q += ` ORDER BY u.last_name, u.first_name LIMIT $${p++} OFFSET $${p++}`;
        params.push(parseInt(limit), parseInt(offset));
        const { rows } = await database_1.db.query(q, params);
        res.json({ success: true, data: rows });
    }
    catch (e) {
        next(e);
    }
}
// GET /users/me
async function getMe(req, res, next) {
    try {
        const { rows } = await database_1.db.query(`SELECT ${PUBLIC_COLS} FROM users u WHERE id = $1`, [auth(req).userId]);
        if (!rows.length)
            throw new AppError_1.AppError('Utilisateur introuvable', 404);
        res.json({ success: true, data: rows[0] });
    }
    catch (e) {
        next(e);
    }
}
// GET /users/:id
async function getUser(req, res, next) {
    try {
        const { userId, role } = auth(req);
        if (role === 'agent' && req.params.id !== userId)
            throw new AppError_1.AppError('Accès refusé', 403);
        const { rows } = await database_1.db.query(`
      SELECT u.${PUBLIC_COLS.replace(/\n\s+/g, ' ')},
             json_agg(json_build_object(
               'id', m.id, 'title', m.title, 'status', m.status,
               'quality_score', m.quality_score, 'scheduled_start', m.scheduled_start
             ) ORDER BY m.scheduled_start DESC) FILTER (WHERE m.id IS NOT NULL) AS recent_missions
      FROM users u
      LEFT JOIN missions m ON m.agent_id = u.id
      WHERE u.id = $1
      GROUP BY u.id
    `, [req.params.id]);
        if (!rows.length)
            throw new AppError_1.AppError('Utilisateur introuvable', 404);
        res.json({ success: true, data: rows[0] });
    }
    catch (e) {
        next(e);
    }
}
// PUT /users/:id
async function updateUser(req, res, next) {
    try {
        const { userId, role } = auth(req);
        if (role === 'agent' && req.params.id !== userId)
            throw new AppError_1.AppError('Accès refusé', 403);
        const { first_name, last_name, phone, avatar_url, fcm_token, device_id, id_card_number, birth_date, birth_place, home_address, blood_type, emergency_contact_name, emergency_contact_phone, contract_type, hire_date, specialties, uniform_size, shoe_size, notes, } = req.body;
        const roleChange = role === 'admin' ? req.body.role : undefined;
        const activeChange = role === 'admin' ? req.body.is_active : undefined;
        const { rows } = await database_1.db.query(`
      UPDATE users SET
        first_name               = COALESCE($1,  first_name),
        last_name                = COALESCE($2,  last_name),
        phone                    = COALESCE($3,  phone),
        avatar_url               = COALESCE($4,  avatar_url),
        fcm_token                = COALESCE($5,  fcm_token),
        device_id                = COALESCE($6,  device_id),
        role                     = COALESCE($7,  role),
        is_active                = COALESCE($8,  is_active),
        id_card_number           = COALESCE($9,  id_card_number),
        birth_date               = COALESCE($10, birth_date),
        birth_place              = COALESCE($11, birth_place),
        home_address             = COALESCE($12, home_address),
        blood_type               = COALESCE($13, blood_type),
        emergency_contact_name   = COALESCE($14, emergency_contact_name),
        emergency_contact_phone  = COALESCE($15, emergency_contact_phone),
        contract_type            = COALESCE($16, contract_type),
        hire_date                = COALESCE($17, hire_date),
        specialties              = COALESCE($18, specialties),
        uniform_size             = COALESCE($19, uniform_size),
        shoe_size                = COALESCE($20, shoe_size),
        notes                    = COALESCE($21, notes),
        updated_at               = NOW()
      WHERE id = $22
      RETURNING ${PUBLIC_COLS}
    `, [first_name, last_name, phone, avatar_url, fcm_token, device_id,
            roleChange ?? null, activeChange ?? null,
            id_card_number || null, birth_date || null, birth_place || null,
            home_address || null, blood_type || null,
            emergency_contact_name || null, emergency_contact_phone || null,
            contract_type || null, hire_date || null,
            specialties ?? null, uniform_size || null, shoe_size || null, notes || null,
            req.params.id]);
        if (!rows.length)
            throw new AppError_1.AppError('Utilisateur introuvable', 404);
        await audit_service_1.AuditService.log({
            userId, action: 'user_updated',
            resourceType: 'user', resourceId: req.params.id,
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        res.json({ success: true, data: rows[0] });
    }
    catch (e) {
        next(e);
    }
}
// PUT /users/:id/password
async function changePassword(req, res, next) {
    try {
        const { userId } = auth(req);
        if (req.params.id !== userId)
            throw new AppError_1.AppError('Vous ne pouvez changer que votre propre mot de passe', 403);
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password)
            throw new AppError_1.AppError('current_password et new_password requis', 400);
        if (new_password.length < 8)
            throw new AppError_1.AppError('Mot de passe trop court (8 caractères minimum)', 400);
        const { rows } = await database_1.db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        if (!rows.length)
            throw new AppError_1.AppError('Utilisateur introuvable', 404);
        const valid = await bcryptjs_1.default.compare(current_password, rows[0].password_hash);
        if (!valid)
            throw new AppError_1.AppError('Mot de passe actuel incorrect', 401);
        const hash = await bcryptjs_1.default.hash(new_password, 12);
        await database_1.db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, userId]);
        res.json({ success: true, message: 'Mot de passe mis à jour' });
    }
    catch (e) {
        next(e);
    }
}
// DELETE /users/:id  (admin only — soft delete)
async function deleteUser(req, res, next) {
    try {
        assertRole(req, ['admin']);
        const { rows } = await database_1.db.query(`UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`, [req.params.id]);
        if (!rows.length)
            throw new AppError_1.AppError('Utilisateur introuvable', 404);
        await audit_service_1.AuditService.log({
            userId: auth(req).userId, action: 'user_deleted',
            resourceType: 'user', resourceId: req.params.id,
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        res.json({ success: true, message: 'Utilisateur désactivé' });
    }
    catch (e) {
        next(e);
    }
}
// GET /users/agents/available  — agents disponibles pour assigner une mission
async function listAvailableAgents(req, res, next) {
    try {
        assertRole(req, ['admin', 'manager']);
        const { rows } = await database_1.db.query(`
      SELECT id, first_name, last_name, email, status, quality_score, avatar_url
      FROM users
      WHERE role = 'agent' AND is_active = true AND status = 'disponible'
      ORDER BY quality_score DESC, last_name
    `);
        res.json({ success: true, data: rows });
    }
    catch (e) {
        next(e);
    }
}
//# sourceMappingURL=user.controller.js.map