import { Request, Response, NextFunction } from 'express';
import { db } from '../config/database';
import { AuditService } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import bcrypt from 'bcryptjs';

type AuthReq = Request & { user: { userId: string; role: string } };
function auth(req: Request) { return (req as AuthReq).user; }
function assertRole(req: Request, roles: string[]) {
  if (!roles.includes(auth(req).role))
    throw new AppError(`Accès réservé aux rôles : ${roles.join(', ')}`, 403);
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
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { role, status, search, limit = '50', offset = '0' } = req.query as Record<string, string>;

    let q = `SELECT ${PUBLIC_COLS},
               (SELECT COUNT(*) FROM missions WHERE agent_id = u.id AND status = 'completed') AS missions_completed,
               (SELECT COUNT(*) FROM missions WHERE agent_id = u.id AND status = 'in_progress') AS missions_active
             FROM users u WHERE 1=1`;
    const params: unknown[] = [];
    let p = 1;

    if (role) { q += ` AND u.role = $${p++}`; params.push(role); }
    if (status) { q += ` AND u.status = $${p++}`; params.push(status); }
    if (search) {
      q += ` AND (u.first_name ILIKE $${p} OR u.last_name ILIKE $${p} OR u.email ILIKE $${p})`;
      params.push(`%${search}%`); p++;
    }
    q += ` ORDER BY u.last_name, u.first_name LIMIT $${p++} OFFSET $${p++}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await db.query(q, params);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}

// GET /users/me
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_COLS} FROM users u WHERE id = $1`,
      [auth(req).userId],
    );
    if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
}

// GET /users/:id
export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    if (role === 'agent' && req.params.id !== userId)
      throw new AppError('Accès refusé', 403);

    const { rows } = await db.query(`
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

    if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
}

// PUT /users/:id
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    if (role === 'agent' && req.params.id !== userId)
      throw new AppError('Accès refusé', 403);
    if (role === 'manager' && req.params.id !== userId) {
      const targetUser = await db.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
      if (!targetUser.rows[0] || targetUser.rows[0].role !== 'agent')
        throw new AppError('Accès refusé: les managers ne peuvent modifier que les agents', 403);
    }

    const {
      first_name, last_name, phone, avatar_url, fcm_token, device_id,
      id_card_number, birth_date, birth_place, home_address, blood_type,
      emergency_contact_name, emergency_contact_phone,
      contract_type, hire_date, specialties, uniform_size, shoe_size, notes,
    } = req.body;

    const roleChange   = (role === 'admin' || role === 'manager') ? req.body.role      : undefined;
    const activeChange = role === 'admin' ? req.body.is_active  : undefined;

    const { rows } = await db.query(`
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

    if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
    await AuditService.log({
      userId, action: 'user_updated',
      resourceType: 'user', resourceId: req.params.id,
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
}

// PUT /users/:id/password
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = auth(req);
    const targetId = req.params.id;
    const isChangingOther = targetId !== userId;

    if (isChangingOther && !['admin', 'manager'].includes(role)) {
      throw new AppError('Accès refusé: seuls les admin/manager peuvent changer les mots de passe des autres', 403);
    }
    if (isChangingOther && role === 'manager') {
      const targetUser = await db.query('SELECT role FROM users WHERE id = $1', [targetId]);
      if (!targetUser.rows[0] || targetUser.rows[0].role !== 'agent')
        throw new AppError('Accès refusé: les managers ne peuvent changer les mots de passe que des agents', 403);
    }

    const { current_password, new_password } = req.body;
    if (!new_password) throw new AppError('new_password requis', 400);
    if (new_password.length < 8) throw new AppError('Mot de passe trop court (8 caractères minimum)', 400);

    if (!isChangingOther) {
      if (!current_password) throw new AppError('current_password requis', 400);
      const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
      const valid = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!valid) throw new AppError('Mot de passe actuel incorrect', 401);
    }

    const hash = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, targetId]);
    await AuditService.log({
      userId, action: 'PASSWORD_CHANGED', resourceType: 'user', resourceId: targetId,
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Mot de passe mis à jour' });
  } catch (e) { next(e); }
}

// DELETE /users/:id  (admin only — soft delete)
export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin']);
    const { rows } = await db.query(
      `UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [req.params.id],
    );
    if (!rows.length) throw new AppError('Utilisateur introuvable', 404);
    await AuditService.log({
      userId: auth(req).userId, action: 'user_deleted',
      resourceType: 'user', resourceId: req.params.id,
      ipAddress: req.ip, userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, message: 'Utilisateur désactivé' });
  } catch (e) { next(e); }
}

// GET /users/agents/available  — agents disponibles pour assigner une mission
export async function listAvailableAgents(req: Request, res: Response, next: NextFunction) {
  try {
    assertRole(req, ['admin', 'manager']);
    const { rows } = await db.query(`
      SELECT id, first_name, last_name, email, status, quality_score, avatar_url
      FROM users
      WHERE role = 'agent' AND is_active = true AND status = 'disponible'
      ORDER BY quality_score DESC, last_name
    `);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
}
