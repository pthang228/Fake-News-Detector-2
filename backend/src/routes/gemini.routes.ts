import { Router } from 'express';
import { analyzePrompt } from '../controllers/gemini.controller';
import { verifyFirebaseToken } from '../middlewares/auth.middleware'; // Middleware bảo vệ route

const router = Router();

// Route POST với middleware verifyFirebaseToken (nếu cần)
router.post('/analyze', verifyFirebaseToken, analyzePrompt as any);

export default router;