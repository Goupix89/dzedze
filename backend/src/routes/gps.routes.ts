import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { createGpsCheckin, getAgentLastLocation } from '../controllers/gps.controller';

const router = Router();
router.use(authenticate);

router.post('/checkin', createGpsCheckin);
router.get('/agents/:id/last-location', getAgentLastLocation);

export default router;
