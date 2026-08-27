import type { Transaction } from 'sequelize';
import { Payment, Plan } from '@/models/index';
import { createOrder } from './razorpay.service';

const PRO_PLAN_AMOUNT_PAISE = 29900;

export interface PaymentOrderResult {
  paymentId: number;
  orderId: string;
  amount: number;
  currency: string;
  key?: string;
}

export const createPaymentOrder = async (userid: number): Promise<PaymentOrderResult> => {
  const plan = await Plan.findOne({ where: { code: 'PRO' } });
  if (!plan) {
    throw new Error('PRO plan not found');
  }

  const razorpayOrder = await createOrder(PRO_PLAN_AMOUNT_PAISE, 'INR', {
    userid: String(userid),
    planCode: 'PRO',
  });

  const payment = await Payment.create({
    userid,
    razorpayOrderId: razorpayOrder.id,
    amount: PRO_PLAN_AMOUNT_PAISE,
    currency: 'INR',
    status: 'CREATED',
  });

  return {
    paymentId: payment.paymentid,
    orderId: razorpayOrder.id,
    amount: PRO_PLAN_AMOUNT_PAISE,
    currency: 'INR',
    key: process.env.RAZORPAY_TEST_API_KEY,
  };
};

export const getPaymentByOrderId = async (
  razorpayOrderId: string,
  transaction: Transaction | null = null
) => {
  return Payment.findOne({
    where: { razorpayOrderId },
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction: transaction ?? undefined,
  });
};

export const markPaymentPaid = async (
  razorpayOrderId: string,
  razorpayPaymentId: string,
  transaction: Transaction | null = null
) => {
  const payment = await getPaymentByOrderId(razorpayOrderId, transaction);
  if (!payment) {
    throw new Error(`Payment not found for order: ${razorpayOrderId}`);
  }

  if (payment.status === 'PAID') {
    return { updated: false, payment };
  }

  payment.status = 'PAID';
  payment.razorpayPaymentId = razorpayPaymentId;
  payment.updatedAt = new Date();
  await payment.save({ transaction: transaction ?? undefined });

  return { updated: true, payment };
};

export const markPaymentFailed = async (
  razorpayOrderId: string,
  transaction: Transaction | null = null
) => {
  const payment = await getPaymentByOrderId(razorpayOrderId, transaction);
  if (!payment) {
    throw new Error(`Payment not found for order: ${razorpayOrderId}`);
  }

  if (payment.status === 'FAILED' || payment.status === 'PAID') {
    return { updated: false, payment };
  }

  payment.status = 'FAILED';
  payment.updatedAt = new Date();
  await payment.save({ transaction: transaction ?? undefined });

  return { updated: true, payment };
};
