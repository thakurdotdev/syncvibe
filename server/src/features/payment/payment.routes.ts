import { Router } from 'express';
import express from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { paymentLimiter } from '@/config/index';
import { createOrder, getEntitlement, getPlans, getPaymentHistory } from './payment.controller';
import { handleRazorpayWebhook } from './webhook.controller';

export const paymentWebhookRouter: Router = Router();
paymentWebhookRouter.post(
  '/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

export const paymentRouter: Router = Router();

// Plans
paymentRouter.get('/plans', getPlans);
paymentRouter.get('/payment/plans', getPlans);

// Orders & Payments
paymentRouter.post('/payments/create', authMiddleware, paymentLimiter, createOrder);
paymentRouter.post('/payment/create', authMiddleware, paymentLimiter, createOrder);

// Payment History
paymentRouter.get('/payments/history', authMiddleware, getPaymentHistory);
paymentRouter.get('/payment/history', authMiddleware, getPaymentHistory);

// Entitlements
paymentRouter.get('/entitlement', authMiddleware, getEntitlement);
paymentRouter.get('/payment/entitlement', authMiddleware, getEntitlement);
