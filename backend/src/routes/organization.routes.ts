import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { getMyOrg, listPlans, upgradePlan } from '../controllers/organization.controller';

const router = Router();

router.get('/plans', listPlans);                              // public — used by signup page
router.use(authenticate);
router.get('/me',      requireRole('admin','manager'), getMyOrg);
router.post('/upgrade', requireRole('admin','manager'), upgradePlan);

export default router;
