import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { submitMissionRating, getAgentRatings } from '../controllers/rating.controller';

const router = Router();
router.use(authenticate);

router.post('/missions/:id/rating', submitMissionRating);
router.get('/agents/:id/ratings', getAgentRatings);

export default router;
