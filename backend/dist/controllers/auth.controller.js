"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.signup = signup;
exports.register = register;
exports.giveConsent = giveConsent;
exports.refreshToken = refreshToken;
exports.logout = logout;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const audit_service_1 = require("../services/audit.service");
const AppError_1 = require("../utils/AppError");
const logger_1 = require("../utils/logger");
const plans_1 = require("../config/plans");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
// ── JWT now includes org + plan for middleware use ────────────
function generateTokens(userId, role, orgId, plan) {
    const payload = { userId, role };
    if (orgId)
        payload.orgId = orgId;
    if (plan)
        payload.plan = plan;
    const accessToken = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
    return { accessToken, refreshToken };
}
async function fetchOrgInfo(userId) {
    const res = await database_1.db.query(`SELECT o.id AS org_id, o.name AS org_name, o.plan, o.features, o.platforms,
            o.agent_limit, o.site_limit, o.trial_ends_at, o.is_active AS org_active,
            s.status AS sub_status, s.ends_at AS sub_ends_at
     FROM users u
     JOIN organizations o ON u.organization_id = o.id
     LEFT JOIN subscriptions s ON s.organization_id = o.id AND s.status NOT IN ('cancelled','expired')
     WHERE u.id = $1
     ORDER BY s.created_at DESC LIMIT 1`, [userId]);
    return res.rows[0] ?? null;
}
// ─── Login ────────────────────────────────────────────────────
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        const result = await database_1.db.query(`SELECT id, email, password_hash, first_name, last_name, role,
              is_active, consent_given, organization_id
       FROM users WHERE email = $1`, [email.toLowerCase()]);
        const user = result.rows[0];
        if (!user || !await bcryptjs_1.default.compare(password, user.password_hash)) {
            await audit_service_1.AuditService.log({
                userId: user?.id, action: 'LOGIN_FAILED', resourceType: 'auth',
                details: { email }, ipAddress: req.ip, userAgent: req.headers['user-agent'],
            });
            throw new AppError_1.AppError('Email ou mot de passe incorrect', 401);
        }
        if (!user.is_active)
            throw new AppError_1.AppError('Compte désactivé, contactez votre administrateur', 403);
        const org = user.organization_id ? await fetchOrgInfo(user.id) : null;
        const { accessToken, refreshToken } = generateTokens(user.id, user.role, org?.org_id, org?.plan);
        await redis_1.redis.setex(`refresh:${user.id}`, 7 * 24 * 3600, refreshToken);
        await database_1.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        await audit_service_1.AuditService.log({
            userId: user.id, action: 'LOGIN_SUCCESS', resourceType: 'auth',
            ipAddress: req.ip, userAgent: req.headers['user-agent'],
        });
        logger_1.logger.info(`User ${user.email} logged in`);
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id, email: user.email,
                    firstName: user.first_name, lastName: user.last_name,
                    role: user.role, consentGiven: user.consent_given,
                },
                organization: org ? {
                    id: org.org_id,
                    name: org.org_name,
                    plan: org.plan,
                    features: org.features,
                    platforms: org.platforms,
                    agentLimit: org.agent_limit,
                    siteLimit: org.site_limit,
                    trialEndsAt: org.trial_ends_at,
                    subStatus: org.sub_status,
                } : null,
                accessToken,
                refreshToken,
                requiresConsent: !user.consent_given,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Manager Signup (public — no auth required) ───────────────
async function signup(req, res, next) {
    try {
        const { email, password, firstName, lastName, phone, companyName, plan = 'trial' } = req.body;
        if (!email || !password || !firstName || !lastName || !companyName) {
            throw new AppError_1.AppError('Tous les champs obligatoires doivent être renseignés', 400);
        }
        if (password.length < 8)
            throw new AppError_1.AppError('Mot de passe trop court (8 caractères minimum)', 400);
        if (!['essential', 'business', 'enterprise'].includes(plan) && plan !== 'trial') {
            throw new AppError_1.AppError('Plan invalide', 400);
        }
        const exists = await database_1.db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (exists.rows.length > 0)
            throw new AppError_1.AppError('Email déjà utilisé', 409);
        const planConfig = (0, plans_1.getPlan)(plan);
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        // ── Atomic: create user + org + subscription ──────────────
        const client = await database_1.db.connect();
        try {
            await client.query('BEGIN');
            // 1. Create manager user
            const userRes = await client.query(`INSERT INTO users (email, password_hash, first_name, last_name, role, phone,
                            consent_given, consent_date, consent_version, status)
         VALUES ($1,$2,$3,$4,'manager',$5,true,NOW(),'1.0','disponible')
         RETURNING id`, [email.toLowerCase(), passwordHash, firstName, lastName, phone ?? null]);
            const userId = userRes.rows[0].id;
            // 2. Create organization
            const trialEndsAt = plan === 'trial'
                ? new Date(Date.now() + 14 * 24 * 3600 * 1000)
                : null;
            const orgRes = await client.query(`INSERT INTO organizations
           (name, owner_id, plan, agent_limit, site_limit, features, platforms, trial_ends_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`, [
                companyName, userId,
                plan === 'trial' ? 'trial' : plan,
                planConfig.agentLimit,
                planConfig.siteLimit,
                planConfig.features,
                planConfig.platforms,
                trialEndsAt,
            ]);
            const orgId = orgRes.rows[0].id;
            // 3. Link user to org
            await client.query('UPDATE users SET organization_id = $1 WHERE id = $2', [orgId, userId]);
            // 4. Create subscription record
            await client.query(`INSERT INTO subscriptions (organization_id, plan, price_fcfa, status, ends_at)
         VALUES ($1,$2,$3,$4,$5)`, [orgId, plan, planConfig.priceFcfa,
                plan === 'trial' ? 'trial' : 'active',
                trialEndsAt]);
            // 5. Auto-consent records
            await client.query(`INSERT INTO consent_records (user_id, consent_type, version, given, ip_address)
         SELECT $1, t, '1.0', true, $2
         FROM unnest(ARRAY['data_processing','media_storage','ai_analysis']::text[]) t`, [userId, req.ip]);
            await client.query('COMMIT');
            const { accessToken, refreshToken } = generateTokens(userId, 'manager', orgId, plan);
            await redis_1.redis.setex(`refresh:${userId}`, 7 * 24 * 3600, refreshToken);
            await audit_service_1.AuditService.log({
                userId, action: 'MANAGER_SIGNUP', resourceType: 'organization',
                resourceId: orgId, details: { plan, companyName }, ipAddress: req.ip,
            });
            logger_1.logger.info(`New manager signup: ${email}, plan: ${plan}, org: ${companyName}`);
            res.status(201).json({
                success: true,
                data: {
                    user: { id: userId, email, firstName, lastName, role: 'manager' },
                    organization: { id: orgId, name: companyName, plan, trialEndsAt },
                    accessToken,
                    refreshToken,
                },
            });
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        next(err);
    }
}
// ─── Register agent (manager creates for their org) ───────────
async function register(req, res, next) {
    try {
        const currentUser = req.user;
        const { email, password, firstName, lastName, role = 'agent', phone, idCardNumber, birthDate, birthPlace, homeAddress, bloodType, emergencyContactName, emergencyContactPhone, contractType, hireDate, specialties, uniformSize, shoeSize, notes, } = req.body;
        if (role !== 'agent' && currentUser?.role !== 'admin') {
            throw new AppError_1.AppError('Permissions insuffisantes', 403);
        }
        if (!currentUser?.orgId && currentUser?.role !== 'admin') {
            throw new AppError_1.AppError('Organisation introuvable', 403);
        }
        if (!email || !firstName || !lastName) {
            throw new AppError_1.AppError('email, firstName et lastName sont requis', 400);
        }
        const exists = await database_1.db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (exists.rows.length > 0)
            throw new AppError_1.AppError('Email déjà utilisé', 409);
        const passwordHash = await bcryptjs_1.default.hash(password ?? 'Agent@123!', 12);
        const result = await database_1.db.query(`INSERT INTO users (
        email, password_hash, first_name, last_name, role, phone,
        organization_id, consent_given, consent_date, consent_version,
        id_card_number, birth_date, birth_place, home_address, blood_type,
        emergency_contact_name, emergency_contact_phone,
        contract_type, hire_date, specialties, uniform_size, shoe_size, notes
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,true,NOW(),'1.0',
        $8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
      ) RETURNING id, email, first_name, last_name, role`, [
            email.toLowerCase(), passwordHash, firstName, lastName, role, phone || null,
            currentUser.orgId ?? null,
            idCardNumber || null, birthDate || null, birthPlace || null,
            homeAddress || null, bloodType || null,
            emergencyContactName || null, emergencyContactPhone || null,
            contractType || 'cdd', hireDate || null,
            specialties?.length ? specialties : [],
            uniformSize || null, shoeSize || null, notes || null,
        ]);
        const newUser = result.rows[0];
        await audit_service_1.AuditService.log({
            userId: currentUser.userId, action: 'USER_CREATED', resourceType: 'user',
            resourceId: newUser.id, details: { email, role }, ipAddress: req.ip,
        });
        res.status(201).json({
            success: true,
            data: { id: newUser.id, email: newUser.email, firstName: newUser.first_name, lastName: newUser.last_name, role: newUser.role },
        });
    }
    catch (err) {
        next(err);
    }
}
// ─── Consent ─────────────────────────────────────────────────
async function giveConsent(req, res, next) {
    try {
        const userId = req.user.userId;
        const { consentType, version, given } = req.body;
        await database_1.db.query(`INSERT INTO consent_records (user_id, consent_type, version, given, ip_address, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6)`, [userId, consentType, version, given, req.ip, req.headers['user-agent']]);
        if (given && consentType === 'data_processing') {
            await database_1.db.query('UPDATE users SET consent_given = true, consent_date = NOW(), consent_version = $1 WHERE id = $2', [version, userId]);
        }
        await audit_service_1.AuditService.log({
            userId, action: 'CONSENT_UPDATED', resourceType: 'consent',
            details: { consentType, version, given }, ipAddress: req.ip,
        });
        res.json({ success: true, message: `Consentement ${given ? 'accepté' : 'refusé'}` });
    }
    catch (err) {
        next(err);
    }
}
// ─── Refresh Token ────────────────────────────────────────────
async function refreshToken(req, res, next) {
    try {
        const { refreshToken: token } = req.body;
        if (!token)
            throw new AppError_1.AppError('Token de rafraîchissement manquant', 401);
        const decoded = jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
        const stored = await redis_1.redis.get(`refresh:${decoded.userId}`);
        if (stored !== token)
            throw new AppError_1.AppError('Token invalide ou expiré', 401);
        const userRes = await database_1.db.query('SELECT id, role, organization_id FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);
        if (!userRes.rows[0])
            throw new AppError_1.AppError('Utilisateur introuvable', 404);
        const org = userRes.rows[0].organization_id
            ? await fetchOrgInfo(decoded.userId) : null;
        const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.userId, userRes.rows[0].role, org?.org_id, org?.plan);
        await redis_1.redis.setex(`refresh:${decoded.userId}`, 7 * 24 * 3600, newRefresh);
        res.json({ success: true, data: { accessToken, refreshToken: newRefresh } });
    }
    catch (err) {
        next(err);
    }
}
// ─── Logout ───────────────────────────────────────────────────
async function logout(req, res, next) {
    try {
        const userId = req.user.userId;
        await redis_1.redis.del(`refresh:${userId}`);
        await audit_service_1.AuditService.log({ userId, action: 'LOGOUT', resourceType: 'auth', ipAddress: req.ip });
        res.json({ success: true, message: 'Déconnexion réussie' });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=auth.controller.js.map