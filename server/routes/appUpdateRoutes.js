const express = require("express")
const { getLatestUpdate, getPresignedUrl, createUpdate } = require("../controllers/appUpdateController")
const authMiddleware = require("../middleware/authMiddleware")

const router = express.Router()

router.get("/app-update/latest", getLatestUpdate)
router.get("/app-update/presigned-url", authMiddleware, getPresignedUrl)
router.post("/app-update", authMiddleware, createUpdate)

module.exports = router
