const Cloudinary = require("cloudinary").v2
const crypto = require("crypto")
const { UPLOAD_CONFIG, FOLDER_CONFIG, RATE_LIMIT } = require("../../config/uploadConfig")

const userSignatureCache = new Map()

const cleanupExpiredEntries = () => {
  const now = Date.now()
  for (const [userId, data] of userSignatureCache.entries()) {
    if (now - data.windowStart > RATE_LIMIT.windowMs) {
      userSignatureCache.delete(userId)
    }
  }
}

setInterval(cleanupExpiredEntries, 60 * 1000)

const checkRateLimit = (userId) => {
  const now = Date.now()
  const userData = userSignatureCache.get(userId)

  if (!userData || now - userData.windowStart > RATE_LIMIT.windowMs) {
    userSignatureCache.set(userId, { count: 1, windowStart: now })
    return true
  }

  if (userData.count >= RATE_LIMIT.maxSignatures) {
    return false
  }

  userData.count++
  return true
}

const resolveFolder = (intent) => {
  const folderMap = {
    post: "posts",
    story: "stories",
    profile: "profiles",
  }

  const folder = folderMap[intent]
  if (!folder || !FOLDER_CONFIG[folder]) {
    return null
  }

  return folder
}

const getUploadSignature = async (req, res) => {
  try {
    const { userid, role } = req.user
    const { intent = "post", resourceType = "image" } = req.query

    if (role === "guest") {
      return res.status(403).json({
        message: "Guest users cannot upload files",
        code: "FORBIDDEN",
      })
    }

    if (!checkRateLimit(userid)) {
      return res.status(429).json({
        message: "Too many upload requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED",
      })
    }

    const folder = resolveFolder(intent, role)
    if (!folder) {
      return res.status(400).json({
        message: "Invalid upload intent",
        code: "VALIDATION_ERROR",
      })
    }

    const folderConfig = FOLDER_CONFIG[folder]
    if (!folderConfig.allowedTypes.includes(resourceType)) {
      return res.status(400).json({
        message: `${resourceType} uploads not allowed for ${intent}`,
        code: "VALIDATION_ERROR",
      })
    }

    const uploadConfig = UPLOAD_CONFIG[resourceType]
    if (!uploadConfig) {
      return res.status(400).json({
        message: "Invalid resource type",
        code: "VALIDATION_ERROR",
      })
    }

    const timestamp = Math.round(Date.now() / 1000)
    const uniqueId = crypto.randomBytes(8).toString("hex")
    const publicId = `${folder}_${userid}_${timestamp}_${uniqueId}`

    const paramsToSign = {
      timestamp,
      folder,
      public_id: publicId,
      allowed_formats: uploadConfig.allowedFormats.join(","),
      overwrite: false,
    }

    const signature = Cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_SECRET)

    console.log(
      `[UPLOAD_SIGNATURE] userId=${userid} folder=${folder} resourceType=${resourceType} publicId=${publicId} timestamp=${timestamp}`,
    )

    return res.status(200).json({
      signature,
      timestamp,
      cloudName: process.env.CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_KEY,
      folder,
      publicId,
      resourceType,
      allowedFormats: uploadConfig.allowedFormats,
      maxFileSize: uploadConfig.maxFileSize,
    })
  } catch (error) {
    console.error("Error generating upload signature:", error)
    return res.status(500).json({
      message: "Failed to generate upload signature",
      code: "SERVER_ERROR",
    })
  }
}

module.exports = {
  getUploadSignature,
}
