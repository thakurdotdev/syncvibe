const express = require("express")
const router = express.Router()
const authMiddleware = require("../middleware/authMiddleware")
const { paymentLimiter } = require("../config")
const {
  createOrder,
  getEntitlement,
  getPlans,
  getPaymentHistory,
} = require("../controllers/payment/paymentController")

router.get("/plans", getPlans)
router.post("/payments/create", authMiddleware, paymentLimiter, createOrder)
router.get("/payments/history", authMiddleware, getPaymentHistory)
router.get("/entitlement", authMiddleware, getEntitlement)

module.exports = router
