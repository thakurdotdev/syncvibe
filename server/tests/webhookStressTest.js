const crypto = require("crypto")
const axios = require("axios")
const dotenv = require("dotenv")
dotenv.config()

const BASE_URL = process.env.TEST_URL || "http://localhost:4000"
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test_webhook_secret"

const generateSignature = (payload) => {
  return crypto.createHmac("sha256", WEBHOOK_SECRET).update(JSON.stringify(payload)).digest("hex")
}

const sendWebhook = async (payload, signature = null) => {
  const body = JSON.stringify(payload)
  const sig = signature || generateSignature(payload)

  try {
    const response = await axios.post(`${BASE_URL}/api/webhooks/razorpay`, body, {
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": sig,
      },
      validateStatus: () => true,
    })
    return { status: response.status, data: response.data }
  } catch (error) {
    return { status: error.response?.status || 500, error: error.message }
  }
}

const createPayload = (orderId, paymentId, event = "payment.captured") => ({
  event,
  payload: {
    payment: {
      entity: {
        id: paymentId,
        order_id: orderId,
        amount: 29900,
        currency: "INR",
        status: event === "payment.captured" ? "captured" : "failed",
      },
    },
  },
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = { passed: 0, failed: 0, tests: [] }

const logResult = (name, passed, details = "") => {
  const status = passed ? "✅ PASS" : "❌ FAIL"
  console.log(`${status}: ${name}${details ? ` - ${details}` : ""}`)
  results.tests.push({ name, passed, details })
  passed ? results.passed++ : results.failed++
}

async function testInvalidSignature() {
  console.log("\n--- Test: Invalid Signature ---")
  const payload = createPayload("order_invalid_sig", "pay_test123")
  const res = await sendWebhook(payload, "invalid_signature_here")
  logResult("Invalid signature → 400", res.status === 400, `Status: ${res.status}`)
}

async function testMissingSignature() {
  console.log("\n--- Test: Missing Signature ---")
  const body = JSON.stringify(createPayload("order_no_sig", "pay_test456"))

  try {
    const response = await axios.post(`${BASE_URL}/api/webhooks/razorpay`, body, {
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    })
    logResult("Missing signature → 400", response.status === 400, `Status: ${response.status}`)
  } catch (error) {
    logResult("Missing signature → 400", false, error.message)
  }
}

async function testMalformedJSON() {
  console.log("\n--- Test: Malformed JSON ---")
  const sig = crypto.createHmac("sha256", WEBHOOK_SECRET).update("not valid json{").digest("hex")

  try {
    const response = await axios.post(`${BASE_URL}/api/webhooks/razorpay`, "not valid json{", {
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": sig,
      },
      validateStatus: () => true,
    })
    logResult("Malformed JSON → 400", response.status === 400, `Status: ${response.status}`)
  } catch (error) {
    logResult("Malformed JSON → 400", false, error.message)
  }
}

async function testMissingOrderId() {
  console.log("\n--- Test: Missing Order ID (valid signed) ---")
  const payload = {
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_test789", amount: 29900 } } },
  }
  const res = await sendWebhook(payload)
  logResult("Missing order_id → 200 (ACK)", res.status === 200, `Status: ${res.status}`)
}

async function testNonExistentOrder() {
  console.log("\n--- Test: Non-existent Order (valid signed) ---")
  const payload = createPayload("order_NONEXISTENT_xyz", "pay_nonexistent")
  const res = await sendWebhook(payload)
  logResult("Non-existent order → 200 (ACK)", res.status === 200, `Status: ${res.status}`)
}

async function testIgnoredEvent() {
  console.log("\n--- Test: Ignored Event Type (payment.authorized) ---")
  const payload = {
    event: "payment.authorized",
    payload: {
      payment: { entity: { id: "pay_auth", order_id: "order_auth", amount: 29900 } },
    },
  }
  const res = await sendWebhook(payload)
  logResult("Ignored event → 200 (ACK)", res.status === 200, `Status: ${res.status}`)
}

async function testPaymentFailed() {
  console.log("\n--- Test: Payment Failed Event (non-existent order) ---")
  const payload = createPayload(
    `order_fail_${Date.now()}`,
    `pay_fail_${Date.now()}`,
    "payment.failed",
  )
  const res = await sendWebhook(payload)
  logResult("Payment failed (no order) → 200 (ACK)", res.status === 200, `Status: ${res.status}`)
}

async function testDuplicateWebhooks() {
  console.log("\n--- Test: Duplicate Webhooks (Idempotency) ---")
  const orderId = `order_dup_test_${Date.now()}`
  const paymentId = `pay_dup_${Date.now()}`
  const payload = createPayload(orderId, paymentId)

  console.log("  Note: Order doesn't exist in DB, all should return 200 (ignored)")

  const res1 = await sendWebhook(payload)
  const res2 = await sendWebhook(payload)
  const res3 = await sendWebhook(payload)

  const allAcked = [res1, res2, res3].every((r) => r.status === 200)
  logResult(
    "Duplicate webhooks → all 200 (ACK)",
    allAcked,
    `Responses: ${res1.status}, ${res2.status}, ${res3.status}`,
  )
}

async function testConcurrentWebhooks() {
  console.log("\n--- Test: Concurrent Webhooks ---")
  const orderId = `order_conc_${Date.now()}`
  const paymentId = `pay_conc_${Date.now()}`
  const payload = createPayload(orderId, paymentId)

  console.log("  Sending 10 concurrent requests (no DB order)...")

  const promises = Array.from({ length: 10 }, () => sendWebhook(payload))
  const responses = await Promise.all(promises)

  const statusCounts = responses.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  const all200 = statusCounts["200"] === 10
  logResult(
    "Concurrent webhooks → all 200",
    all200,
    `Distribution: ${JSON.stringify(statusCounts)}`,
  )
}

async function testHighVolumeLoad() {
  console.log("\n--- Test: High Volume Load (50 requests) ---")
  const start = Date.now()

  const promises = Array.from({ length: 50 }, (_, i) => {
    const payload = createPayload(`order_load_${i}`, `pay_load_${i}`)
    return sendWebhook(payload)
  })

  const responses = await Promise.all(promises)
  const duration = Date.now() - start

  const avgTime = duration / 50
  console.log(`  Total time: ${duration}ms, Avg per request: ${avgTime.toFixed(2)}ms`)

  const all200 = responses.every((r) => r.status === 200)
  const errorCount = responses.filter((r) => r.status >= 500).length
  logResult("High volume → all 200", all200, `Errors: ${errorCount}/50, Time: ${duration}ms`)
}

async function runAllTests() {
  console.log("=".repeat(60))
  console.log("WEBHOOK STRESS TEST - CORRECT RESPONSE MATRIX")
  console.log(`Target: ${BASE_URL}/api/webhooks/razorpay`)
  console.log("=".repeat(60))
  console.log("\nExpected responses:")
  console.log("  400 → Missing/invalid signature, malformed body")
  console.log("  200 → All valid signed events (even if order not found)")
  console.log("  500 → Only on actual server crash")

  await testInvalidSignature()
  await testMissingSignature()
  await testMalformedJSON()
  await testMissingOrderId()
  await testNonExistentOrder()
  await testIgnoredEvent()
  await testPaymentFailed()
  await testDuplicateWebhooks()
  await testConcurrentWebhooks()
  await testHighVolumeLoad()

  console.log("\n" + "=".repeat(60))
  console.log("SUMMARY")
  console.log("=".repeat(60))
  console.log(`Passed: ${results.passed}`)
  console.log(`Failed: ${results.failed}`)
  console.log(`Total:  ${results.passed + results.failed}`)

  if (results.failed > 0) {
    console.log("\nFailed tests:")
    results.tests
      .filter((t) => !t.passed)
      .forEach((t) => console.log(`  - ${t.name}: ${t.details}`))
  }
}

runAllTests().catch(console.error)
