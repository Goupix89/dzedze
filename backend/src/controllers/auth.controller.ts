import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { AuditService } from '../services/audit.service';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken };
}

// ─── Login ────────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active, consent_given FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      await AuditService.log({
        userId: user?.id,
        action: 'LOGIN_FAILED',
        resourceType: 'auth',
        details: { email, reason: !user ? 'user_not_found' : 'wrong_password' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      throw new AppError('Email ou mot de passe incorrect', 401);
    }

    if (!user.is_active) throw new AppError('Compte désactivé, contactez votre administrateur', 403);

    const { accessToken, refreshToken } = generateTokens(user.id, user.role);

    // Store refresh token in Redis with 7d TTL
    await redis.setex(`refresh:${user.id}`, 7 * 24 * 3600, refreshToken);

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    await AuditService.log({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info(`User ${user.email} logged in`);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          consentGiven: user.consent_given,
        },
        accessToken,
        refreshToken,
        requiresConsent: !user.consent_given,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Register ─────────────────────────────────────────────────
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, role, phone } = req.body;

    // Only admins can create manager/admin accounts
    const currentUser = (req as any).user;
    if (role !== 'agent' && currentUser?.role !== 'admin') {
      throw new AppError('Permissions insuffisantes pour créer ce type de compte', 403);
    }

    const exists = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length > 0) throw new AppError('Email déjà utilisé', 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role, phone]
    );

    const newUser = result.rows[0];

    await AuditService.log({
      userId: currentUser?.id,
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: newUser.id,
      details: { email, role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        role: newUser.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─── Consent ─────────────────────────────────────────────────
export async function giveConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    const { consentType, version, given } = req.body;

    await db.query(
      `INSERT INTO consent_records (user_id, consent_type, version, given, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, consentType, version, given, req.ip, req.headers['user-agent']]
    );

    if (given && consentType === 'data_processing') {
      await db.query(
        'UPDATE users SET consent_given = true, consent_date = NOW(), consent_version = $1 WHERE id = $2',
        [version, userId]
      );
    }

    await AuditService.log({
      userId,
      action: 'CONSENT_UPDATED',
      resourceType: 'consent',
      details: { consentType, version, given },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Consentement ${given ? 'accepté' : 'refusé'}` });
  } catch (err) {
    next(err);
  }
}

// ─── Refresh Token ────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AppError('Token de rafraîchissement manquant', 401);

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    const stored = await redis.get(`refresh:${decoded.userId}`);

    if (stored !== token) throw new AppError('Token invalide ou expiré', 401);

    const userResult = await db.query('SELECT id, role FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);
    if (!userResult.rows[0]) throw new AppError('Utilisateur introuvable', 404);

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId, userResult.rows[0].role);
    await redis.setex(`refresh:${decoded.userId}`, 7 * 24 * 3600, newRefreshToken);

    res.json({ success: true, data: { accessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.userId;
    await redis.del(`refresh:${userId}`);
    await AuditService.log({ userId, action: 'LOGOUT', resourceType: 'auth', ipAddress: req.ip });
    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (err) {
    next(err);
  }
}
