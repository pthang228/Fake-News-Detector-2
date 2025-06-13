import { Router } from 'express';
import { login } from '../controllers/auth.controller';
import { verifyFirebaseToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', verifyFirebaseToken, login);

export default router;
