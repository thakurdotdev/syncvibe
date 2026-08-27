import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Plan, Payment } from '@/models/index';
import { createPaymentOrder } from './services/payment.service';
import { getActiveEntitlement, getUserEntitlement } from '@/services/entitlement.service';

const PENDING_ORDER_TIMEOUT_MINUTES = 10;

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = req.user!.userid;

    const existingPro = await getActiveEntitlement(userid, 'PRO');
    if (existingPro) {
      res.status(400).json({ message: 'You already have an active PRO subscription' });
      return;
    }

    const pendingOrder = await Payment.findOne({
      where: {
        userid,
        status: 'CREATED',
        createdAt: { [Op.gt]: new Date(Date.now() - PENDING_ORDER_TIMEOUT_MINUTES * 60 * 1000) },
      },
      order: [['createdAt', 'DESC']],
    });

    if (pendingOrder) {
      res.json({
        paymentId: pendingOrder.paymentid,
        orderId: pendingOrder.razorpayOrderId,
        amount: pendingOrder.amount,
        currency: pendingOrder.currency,
        key: process.env.RAZORPAY_TEST_API_KEY,
        resumed: true,
      });
      return;
    }

    const orderData = await createPaymentOrder(userid);
    res.json(orderData);
  } catch (error) {
    console.error('Failed to create payment order:', error);
    res.status(500).json({ message: 'Failed to create payment order' });
  }
};

export const getEntitlement = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = req.user!.userid;
    const entitlement = await getUserEntitlement(userid);
    res.json(entitlement ?? { plan: { code: 'FREE', name: 'Free' } });
  } catch (error) {
    console.error('Failed to fetch entitlement:', error);
    res.status(500).json({ message: 'Failed to fetch entitlement' });
  }
};

export const getPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    const plans = await Plan.findAll({ order: [['planid', 'ASC']] });
    res.json(plans);
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    res.status(500).json({ message: 'Failed to fetch plans' });
  }
};

export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = req.user!.userid;
    const payments = await Payment.findAll({
      where: { userid, status: ['PAID', 'FAILED'] },
      order: [['createdAt', 'DESC']],
      attributes: [
        'paymentid',
        'razorpayOrderId',
        'razorpayPaymentId',
        'amount',
        'currency',
        'status',
        'createdAt',
      ],
    });
    res.json(payments);
  } catch (error) {
    console.error('Failed to fetch payment history:', error);
    res.status(500).json({ message: 'Failed to fetch payment history' });
  }
};
