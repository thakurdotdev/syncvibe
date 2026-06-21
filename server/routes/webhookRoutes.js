const express = require("express")
const router = express.Router()
const { handleRazorpayWebhook } = require("../controllers/payment/webhookController")
const { handleEasWebhook } = require("../controllers/easWebhookController")

router.post("/webhooks/razorpay", express.raw({ type: "application/json" }), handleRazorpayWebhook)
router.post("/webhooks/eas", express.raw({ type: "application/json" }), handleEasWebhook)

module.exports = router
