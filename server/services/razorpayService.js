const Razorpay = require("razorpay")
const crypto = require("crypto")

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_TEST_API_KEY,
  key_secret: process.env.RAZORPAY_TEST_API_SECRET,
})

const createOrder = async (amountInPaise, currency = "INR", notes = {}) => {
  const order = await razorpay.orders.create({
    amount: amountInPaise,
    currency,
    notes,
  })
  return order
}

const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET not configured")
  }

  try {
    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
    const sigBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expectedSignature)

    if (sigBuffer.length !== expectedBuffer.length) {
      return false
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  } catch {
    return false
  }
}

module.exports = {
  razorpay,
  createOrder,
  verifyWebhookSignature,
}
