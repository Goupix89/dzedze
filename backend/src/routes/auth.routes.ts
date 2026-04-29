import { Router } from 'express';
import { login, signup, register, giveConsent, refreshToken, logout } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login',    login);
router.post('/signup',   signup);           // public — manager self-registration
router.post('/register', authenticate, register);  // manager creates agents in their org
router.post('/consent',  authenticate, giveConsent);
router.post('/refresh',  refreshToken);
router.post('/logout',   authenticate, logout);

export default router;
