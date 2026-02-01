const { Op } = require("sequelize")
const { createPaymentOrder } = require("../../services/paymentService")
const { getActiveEntitlement, getUserEntitlement } = require("../../services/entitlementService")
const Plan = require("../../models/payment/planModel")
const Payment = require("../../models/payment/paymentModel")

const PENDING_ORDER_TIMEOUT_MINUTES = 10

const createOrder = async (req, res) => {
  try {
    const userid = req.user.userid

    const existingPro = await getActiveEntitlement(userid, "PRO")
    if (existingPro) {
      return res.status(400).json({ message: "You already have an active PRO subscription" })
    }

    const pendingOrder = await Payment.findOne({
      where: {
        userid,
        status: "CREATED",
        createdAt: { [Op.gt]: new Date(Date.now() - PENDING_ORDER_TIMEOUT_MINUTES * 60 * 1000) },
      },
      order: [["createdAt", "DESC"]],
    })

    if (pendingOrder) {
      return res.json({
        paymentId: pendingOrder.paymentid,
        orderId: pendingOrder.razorpayOrderId,
        amount: pendingOrder.amount,
        currency: pendingOrder.currency,
        key: process.env.RAZORPAY_TEST_API_KEY,
        resumed: true,
      })
    }

    const orderData = await createPaymentOrder(userid)
    res.json(orderData)
  } catch (error) {
    console.error("Failed to create payment order:", error)
    res.status(500).json({ message: "Failed to create payment order" })
  }
}

const getEntitlement = async (req, res) => {
  try {
    const userid = req.user.userid
    const entitlement = await getUserEntitlement(userid)
    res.json(entitlement || { plan: { code: "FREE", name: "Free" } })
  } catch (error) {
    console.error("Failed to fetch entitlement:", error)
    res.status(500).json({ message: "Failed to fetch entitlement" })
  }
}

const getPlans = async (_req, res) => {
  try {
    const plans = await Plan.findAll({ order: [["planid", "ASC"]] })
    res.json(plans)
  } catch (error) {
    console.error("Failed to fetch plans:", error)
    res.status(500).json({ message: "Failed to fetch plans" })
  }
}

const getPaymentHistory = async (req, res) => {
  try {
    const userid = req.user.userid
    const payments = await Payment.findAll({
      where: {
        userid,
        status: ["PAID", "FAILED"],
      },
      order: [["createdAt", "DESC"]],
      attributes: [
        "paymentid",
        "razorpayOrderId",
        "razorpayPaymentId",
        "amount",
        "currency",
        "status",
        "createdAt",
      ],
    })
    res.json(payments)
  } catch (error) {
    console.error("Failed to fetch payment history:", error)
    res.status(500).json({ message: "Failed to fetch payment history" })
  }
}

module.exports = {
  createOrder,
  getEntitlement,
  getPlans,
  getPaymentHistory,
}
