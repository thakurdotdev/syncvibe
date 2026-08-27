import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { generateTurnCredentials } from './turn.service';

export const turnRouter: Router = Router();

turnRouter.get('/turn/credentials', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const credentials = await generateTurnCredentials();
    res.json(credentials);
  } catch (error) {
    console.error('Failed to generate TURN credentials:', (error as Error).message);
    res.status(502).json({ message: 'Failed to generate TURN credentials' });
  }
});
