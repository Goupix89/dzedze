import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { listSites, createSite, getSite, updateSite, deleteSite } from '../controllers/site.controller';

const router = Router();
router.use(authenticate);

router.get('/', listSites);
router.post('/', createSite);
router.get('/:id', getSite);
router.put('/:id', updateSite);
router.delete('/:id', deleteSite);

export default router;
