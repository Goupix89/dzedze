import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listUsers, getMe, getUser, updateUser, changePassword, deleteUser, listAvailableAgents,
} from '../controllers/user.controller';

const router = Router();
router.use(authenticate);

router.get('/me', getMe);
router.get('/agents/available', listAvailableAgents);
router.get('/', listUsers);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.put('/:id/password', changePassword);
router.delete('/:id', deleteUser);

export default router;
