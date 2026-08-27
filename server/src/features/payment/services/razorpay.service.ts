import Razorpay from 'razorpay';
import crypto from 'node:crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_TEST_API_KEY,
  key_secret: process.env.RAZORPAY_TEST_API_SECRET,
});

interface OrderNotes {
  [key: string]: string;
}

export const createOrder = async (
  amountInPaise: number,
  currency = 'INR',
  notes: OrderNotes = {}
) => {
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency,
    notes,
  });
  return order;
};

export const verifyWebhookSignature = (rawBody: string | Buffer, signature: string): boolean => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET not configured');
  }

  try {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString() : rawBody;
    const expectedSignature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
};

export { razorpay };
