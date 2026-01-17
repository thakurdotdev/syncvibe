const express = require("express")
const authMiddleware = require("../middleware/authMiddleware")
const { getUploadSignature } = require("../controllers/upload/cloudinaryUpload")

const uploadRouter = express.Router()

uploadRouter.route("/upload/signature").get(authMiddleware, getUploadSignature)

module.exports = uploadRouter
