const sequelize = require("../../utils/sequelize")
const { verifyWebhookSignature } = require("../../services/razorpayService")
const { markPaymentPaid, markPaymentFailed } = require("../../services/paymentService")
const { createProEntitlement, getUserEntitlement } = require("../../services/entitlementService")
const { emitToUser } = require("../../utils/socketEmitter")

const handleRazorpayWebhook = async (req, res) => {
  const signature = req.headers["x-razorpay-signature"]
  if (!signature) {
    return res.status(400).json({ message: "Missing signature" })
  }

  const rawBody = req.body
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ message: "Invalid body format" })
  }

  try {
    const isValid = verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      return res.status(400).json({ message: "Invalid signature" })
    }
  } catch {
    return res.status(400).json({ message: "Invalid signature" })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString())
  } catch {
    return res.status(400).json({ message: "Invalid JSON" })
  }

  const event = payload.event
  const paymentEntity = payload.payload?.payment?.entity

  if (!paymentEntity) {
    return res.status(200).json({ message: "Event ignored" })
  }

  const razorpayOrderId = paymentEntity.order_id
  const razorpayPaymentId = paymentEntity.id

  if (!razorpayOrderId) {
    return res.status(200).json({ message: "Ignored: no order_id" })
  }

  if (event === "payment.captured") {
    return handlePaymentCaptured(razorpayOrderId, razorpayPaymentId, res)
  }

  if (event === "payment.failed") {
    return handlePaymentFailed(razorpayOrderId, res)
  }

  return res.status(200).json({ message: "Event ignored" })
}

const handlePaymentCaptured = async (razorpayOrderId, razorpayPaymentId, res) => {
  const transaction = await sequelize.transaction()

  try {
    const { updated, payment } = await markPaymentPaid(
      razorpayOrderId,
      razorpayPaymentId,
      transaction,
    )

    if (updated) {
      await createProEntitlement(payment.userid, payment.paymentid, transaction)
    }

    await transaction.commit()

    if (payment) {
      const entitlement = await getUserEntitlement(payment.userid)
      emitToUser(payment.userid, "payment-success", {
        status: "PAID",
        plan: entitlement?.plan || { code: "PRO", name: "Pro" },
      })
    }

    return res.status(200).json({ message: updated ? "Payment captured" : "Already processed" })
  } catch (error) {
    await transaction.rollback()

    if (error.message?.includes("not found")) {
      console.warn("Webhook: Payment not found, ignoring:", razorpayOrderId)
      return res.status(200).json({ message: "Payment not found, ignored" })
    }

    console.error("Webhook payment.captured error:", error)
    return res.status(500).json({ message: "Internal error" })
  }
}

const handlePaymentFailed = async (razorpayOrderId, res) => {
  const transaction = await sequelize.transaction()

  try {
    const { updated, payment } = await markPaymentFailed(razorpayOrderId, transaction)
    await transaction.commit()

    if (updated && payment) {
      emitToUser(payment.userid, "payment-failed", {
        status: "FAILED",
        message: "Payment failed",
      })
    }

    return res
      .status(200)
      .json({ message: updated ? "Payment failure recorded" : "Already processed" })
  } catch (error) {
    await transaction.rollback()

    if (error.message?.includes("not found")) {
      console.warn("Webhook: Payment not found for failure, ignoring:", razorpayOrderId)
      return res.status(200).json({ message: "Payment not found, ignored" })
    }

    console.error("Webhook payment.failed error:", error)
    return res.status(500).json({ message: "Internal error" })
  }
}

module.exports = {
  handleRazorpayWebhook,
}
