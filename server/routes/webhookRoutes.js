const express = require("express")
const router = express.Router()
const { handleRazorpayWebhook } = require("../controllers/payment/webhookController")

router.post("/webhooks/razorpay", express.raw({ type: "application/json" }), handleRazorpayWebhook)

module.exports = router
