import { Router } from 'express';
import { authRouter } from '@/features/auth/auth.routes';
import { postRouter } from '@/features/post/post.routes';
import { chatRouter } from '@/features/chat/chat.routes';
import { storyRouter } from '@/features/story/story.routes';
import { musicRouter } from '@/features/music/music.routes';
import { uploadRouter } from '@/features/upload/upload.routes';
import { paymentRouter, paymentWebhookRouter } from '@/features/payment/payment.routes';
import { appUpdateRouter, appUpdateWebhookRouter } from '@/features/app-update/app-update.routes';
import { turnRouter } from '@/features/turn/turn.routes';
import { gifRouter } from '@/features/gif/gif.routes';

export const webhookRouter: Router = Router();
webhookRouter.use(paymentWebhookRouter);
webhookRouter.use(appUpdateWebhookRouter);

export const apiRouters: Router[] = [
  authRouter,
  postRouter,
  chatRouter,
  storyRouter,
  musicRouter,
  uploadRouter,
  paymentRouter,
  turnRouter,
  appUpdateRouter,
  gifRouter,
];
