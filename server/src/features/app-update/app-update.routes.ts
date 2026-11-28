import { Router } from 'express';
import express from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { requireAdmin } from '@/middleware/admin.middleware';
import {
  getLatestUpdate,
  getAllUpdates,
  downloadLatestUpdate,
  getPresignedUrl,
  createUpdate,
} from './app-update.controller';
import { handleEasWebhook } from './eas-webhook.controller';

export const appUpdateWebhookRouter: Router = Router();
appUpdateWebhookRouter.post(
  '/webhooks/eas',
  express.raw({ type: 'application/json' }),
  handleEasWebhook
);

export const appUpdateRouter: Router = Router();

appUpdateRouter.get('/app-update/latest', getLatestUpdate);
appUpdateRouter.get('/app-update/all', getAllUpdates);
appUpdateRouter.get('/app-update/download', downloadLatestUpdate);
appUpdateRouter.get('/app-update/presigned-url', authMiddleware, requireAdmin, getPresignedUrl);
appUpdateRouter.post('/app-update', authMiddleware, requireAdmin, createUpdate);
