import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { reportCrash } from './diagnostics.controller';

export const diagnosticsRouter: Router = Router();

diagnosticsRouter.post('/app/crash-reports', authMiddleware, reportCrash);
