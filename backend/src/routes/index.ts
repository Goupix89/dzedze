import { Router } from 'express';
import { authenticate, requireOrgContext } from '../middleware/auth.middleware';
import { validateOrgExists } from '../middleware/orgValidator.middleware';
import { auditSuperadminContext } from '../middleware/auditSuperadmin.middleware';
import authRoutes         from './auth.routes';
import missionRoutes      from './mission.routes';
import mediaRoutes        from './media.routes';
import siteRoutes         from './site.routes';
import userRoutes         from './user.routes';
import auditRoutes        from './audit.routes';
import organizationRoutes from './organization.routes';
import gpsRoutes          from './gps.routes';
import ratingRoutes       from './rating.routes';

const router = Router();

// ─── Public Routes (no auth) ───────────────────────────────────
router.use('/auth',    authRoutes);
router.get('/org/plans', (req, res, next) => {
  organizationRoutes(req, res, next);
});

// ─── Protected Routes with org context ────────────────────────
// Apply: authenticate → validateOrgExists → auditSuperadminContext → requireOrgContext
router.use('/org',     authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, organizationRoutes);
router.use('/users',   authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, userRoutes);
router.use('/sites',   authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, siteRoutes);
router.use('/missions', authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, missionRoutes);
router.use('/media',   authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, mediaRoutes);
router.use('/gps',     authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, gpsRoutes);
router.use('/',        authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, ratingRoutes);
router.use('/audit',   authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, auditRoutes);

if (process.env.ENABLE_STREAM === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const streamRoutes = require('./stream.routes').default;
  router.use('/stream', authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, streamRoutes);
}

if (process.env.ENABLE_AI === 'true') {
  const aiRoutes = require('./ai.routes').default;
  router.use('/ai', authenticate, validateOrgExists, auditSuperadminContext, requireOrgContext, aiRoutes);
}

export default router;
