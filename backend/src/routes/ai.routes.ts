import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getMissionReport, getAgentAIScore } from '../controllers/ai.controller';

const router = Router();

router.use(authenticate);

router.get('/mission/:missionId/report', getMissionReport);
router.get('/agent/:agentId/score',      getAgentAIScore);

export default router;
