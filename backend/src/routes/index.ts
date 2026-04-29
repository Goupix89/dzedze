import { Router } from 'express';
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

router.use('/auth',    authRoutes);
router.use('/org',     organizationRoutes);
router.use('/users',   userRoutes);
router.use('/sites',   siteRoutes);
router.use('/missions', missionRoutes);
router.use('/media', mediaRoutes);
router.use('/gps',   gpsRoutes);
router.use('/',      ratingRoutes);
router.use('/audit', auditRoutes);

if (process.env.ENABLE_STREAM === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const streamRoutes = require('./stream.routes').default;
  router.use('/stream', streamRoutes);
}

if (process.env.ENABLE_AI === 'true') {
  const aiRoutes = require('./ai.routes').default;
  router.use('/ai', aiRoutes);
}

export default router;
