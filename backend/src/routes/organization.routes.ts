import { Router } from 'express';
import { authenticate, requireRole, requireSuperadmin } from '../middleware/auth.middleware';
import { getMyOrg, listPlans, upgradePlan, listAllOrganizations, validateOrgSelection } from '../controllers/organization.controller';

const router = Router();

router.get('/plans', listPlans);                              // public — used by signup page
router.use(authenticate);
router.post('/validate-selection', requireSuperadmin, validateOrgSelection);
router.get('/all',     requireSuperadmin, listAllOrganizations);
router.get('/me',      requireRole('admin', 'manager'), getMyOrg);
router.post('/upgrade', requireRole('admin', 'manager'), upgradePlan);

export default router;
