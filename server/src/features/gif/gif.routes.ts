import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getTrending, search } from './gif.controller';

export const gifRouter: Router = Router();

gifRouter.get('/gifs/trending', authMiddleware, getTrending);
gifRouter.get('/gifs/search', authMiddleware, search);
