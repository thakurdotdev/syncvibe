import type { Request, Response } from 'express';
import sequelize from '@/utils/sequelize';
import { verifyWebhookSignature } from './services/razorpay.service';
import { markPaymentPaid, markPaymentFailed } from './services/payment.service';
import { createProEntitlement, getUserEntitlement } from '@/services/entitlement.service';
import { emitToUser } from '@/utils/socket-emitter';

const handlePaymentCaptured = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  res: Response
): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    const { updated, payment } = await markPaymentPaid(
      razorpayOrderId,
      razorpayPaymentId,
      transaction
    );

    if (updated) {
      await createProEntitlement(payment.userid, payment.paymentid, transaction);
    }

    await transaction.commit();

    if (payment) {
      const entitlement = await getUserEntitlement(payment.userid);
      const plan = (entitlement as unknown as { plan?: { code: string; name: string } })?.plan;
      emitToUser(payment.userid, 'payment-success', {
        status: 'PAID',
        plan: plan ?? { code: 'PRO', name: 'Pro' },
      });
    }

    res.status(200).json({ message: updated ? 'Payment captured' : 'Already processed' });
  } catch (error) {
    await transaction.rollback();

    if ((error as Error).message?.includes('not found')) {
      console.warn('Webhook: Payment not found, ignoring:', razorpayOrderId);
      res.status(200).json({ message: 'Payment not found, ignored' });
      return;
    }

    console.error('Webhook payment.captured error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

const handlePaymentFailed = async (razorpayOrderId: string, res: Response): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    const { updated, payment } = await markPaymentFailed(razorpayOrderId, transaction);
    await transaction.commit();

    if (updated && payment) {
      emitToUser(payment.userid, 'payment-failed', { status: 'FAILED', message: 'Payment failed' });
    }

    res.status(200).json({ message: updated ? 'Payment failure recorded' : 'Already processed' });
  } catch (error) {
    await transaction.rollback();

    if ((error as Error).message?.includes('not found')) {
      console.warn('Webhook: Payment not found for failure, ignoring:', razorpayOrderId);
      res.status(200).json({ message: 'Payment not found, ignored' });
      return;
    }

    console.error('Webhook payment.failed error:', error);
    res.status(500).json({ message: 'Internal error' });
  }
};

export const handleRazorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  if (!signature) {
    res.status(400).json({ message: 'Missing signature' });
    return;
  }

  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ message: 'Invalid body format' });
    return;
  }

  try {
    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      res.status(400).json({ message: 'Invalid signature' });
      return;
    }
  } catch {
    res.status(400).json({ message: 'Invalid signature' });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString()) as Record<string, unknown>;
  } catch {
    res.status(400).json({ message: 'Invalid JSON' });
    return;
  }

  const event = payload.event as string;
  const paymentPayload = payload.payload as Record<string, unknown> | undefined;
  const paymentWrapper = paymentPayload?.payment as Record<string, unknown> | undefined;
  const paymentEntity = paymentWrapper?.entity as Record<string, unknown> | undefined;

  if (!paymentEntity) {
    res.status(200).json({ message: 'Event ignored' });
    return;
  }

  const razorpayOrderId = paymentEntity.order_id as string;
  const razorpayPaymentId = paymentEntity.id as string;

  if (!razorpayOrderId) {
    res.status(200).json({ message: 'Ignored: no order_id' });
    return;
  }

  if (event === 'payment.captured') {
    await handlePaymentCaptured(razorpayOrderId, razorpayPaymentId, res);
    return;
  }

  if (event === 'payment.failed') {
    await handlePaymentFailed(razorpayOrderId, res);
    return;
  }

  res.status(200).json({ message: 'Event ignored' });
};
