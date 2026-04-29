import { Router } from 'express';
import authRoutes         from './auth.routes';
import missionRoutes      from './mission.routes';
import mediaRoutes        from './media.routes';
import streamRoutes       from './stream.routes';
import siteRoutes         from './site.routes';
import userRoutes         from './user.routes';
import auditRoutes        from './audit.routes';
import aiRoutes           from './ai.routes';
import organizationRoutes from './organization.routes';

const router = Router();

router.use('/auth',   authRoutes);
router.use('/org',    organizationRoutes);
router.use('/users',  userRoutes);
router.use('/sites',  siteRoutes);
router.use('/missions', missionRoutes);
router.use('/media',  mediaRoutes);
router.use('/stream', streamRoutes);
router.use('/audit',  auditRoutes);
router.use('/ai',     aiRoutes);

export default router;
