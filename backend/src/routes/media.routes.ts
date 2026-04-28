import { Router } from 'express';
import { uploadMedia, getMedia, getMissionMedia, deleteMedia, uploadMiddleware } from '../controllers/media.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/upload', uploadMiddleware, uploadMedia);
router.get('/mission/:missionId', getMissionMedia);
router.get('/:id', getMedia);
router.delete('/:id', deleteMedia);

export default router;
