const sequelize = require("../utils/sequelize")
const Payment = require("../models/payment/paymentModel")
const Plan = require("../models/payment/planModel")
const { createOrder } = require("./razorpayService")

const PRO_PLAN_AMOUNT_PAISE = 29900

const createPaymentOrder = async (userid) => {
  const plan = await Plan.findOne({ where: { code: "PRO" } })
  if (!plan) {
    throw new Error("PRO plan not found")
  }

  const razorpayOrder = await createOrder(PRO_PLAN_AMOUNT_PAISE, "INR", {
    userid: String(userid),
    planCode: "PRO",
  })

  const payment = await Payment.create({
    userid,
    razorpayOrderId: razorpayOrder.id,
    amount: PRO_PLAN_AMOUNT_PAISE,
    currency: "INR",
    status: "CREATED",
  })

  return {
    paymentId: payment.paymentid,
    orderId: razorpayOrder.id,
    amount: PRO_PLAN_AMOUNT_PAISE,
    currency: "INR",
    key: process.env.RAZORPAY_TEST_API_KEY,
  }
}

const getPaymentByOrderId = async (razorpayOrderId, transaction = null) => {
  return Payment.findOne({
    where: { razorpayOrderId },
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
    transaction,
  })
}

const markPaymentPaid = async (razorpayOrderId, razorpayPaymentId, transaction = null) => {
  const payment = await getPaymentByOrderId(razorpayOrderId, transaction)
  if (!payment) {
    throw new Error(`Payment not found for order: ${razorpayOrderId}`)
  }

  if (payment.status === "PAID") {
    return { updated: false, payment }
  }

  payment.status = "PAID"
  payment.razorpayPaymentId = razorpayPaymentId
  payment.updatedAt = new Date()
  await payment.save({ transaction })

  return { updated: true, payment }
}

const markPaymentFailed = async (razorpayOrderId, transaction = null) => {
  const payment = await getPaymentByOrderId(razorpayOrderId, transaction)
  if (!payment) {
    throw new Error(`Payment not found for order: ${razorpayOrderId}`)
  }

  if (payment.status === "FAILED" || payment.status === "PAID") {
    return { updated: false, payment }
  }

  payment.status = "FAILED"
  payment.updatedAt = new Date()
  await payment.save({ transaction })

  return { updated: true, payment }
}

module.exports = {
  createPaymentOrder,
  getPaymentByOrderId,
  markPaymentPaid,
  markPaymentFailed,
}
