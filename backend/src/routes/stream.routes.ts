import { Router } from 'express';
import { requestStream, respondToStream, stopStream, getStreamSession } from '../controllers/stream.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/request', requestStream);
router.put('/:sessionId/respond', respondToStream);
router.delete('/:sessionId', stopStream);
router.get('/:sessionId', getStreamSession);

export default router;
