import { Router } from 'express';
import { login, register, giveConsent, refreshToken, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', authenticate, register);
router.post('/consent', authenticate, giveConsent);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);

export default router;
