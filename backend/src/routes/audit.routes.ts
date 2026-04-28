import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { listAuditLogs, getAuditStats } from '../controllers/audit.controller';

const router = Router();

router.use(authenticate, requireRole('admin', 'manager'));

router.get('/',       listAuditLogs);
router.get('/stats',  getAuditStats);

export default router;
