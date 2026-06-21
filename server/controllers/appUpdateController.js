const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const AppUpdate = require("../models/appUpdateModel")

exports.getLatestUpdate = async (req, res) => {
  try {
    const latest = await AppUpdate.findOne({
      order: [["createdAt", "DESC"]],
      raw: true,
    })
    return res.status(200).json({ success: true, latest })
  } catch (error) {
    console.error("Error fetching latest update:", error)
    return res.status(500).json({ success: false, message: "Internal server error" })
  }
}

exports.getPresignedUrl = async (req, res) => {
  try {
    if (!req.user || req.user.email !== (process.env.ADMIN_EMAIL)) {
      return res.status(403).json({ success: false, message: "Forbidden" })
    }

    const { version } = req.query
    if (!version) {
      return res.status(400).json({ success: false, message: "Version is required" })
    }

    const existingUpdate = await AppUpdate.findOne({ where: { version } })
    if (existingUpdate) {
      return res.status(400).json({ success: false, message: "This version already exists" })
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })

    const fileKey = `updates/syncvibe-v${version}.apk`
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileKey,
      ContentType: "application/vnd.android.package-archive",
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
    const downloadUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`

    return res.status(200).json({ success: true, uploadUrl, downloadUrl })
  } catch (error) {
    console.error("Error generating presigned URL:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

exports.createUpdate = async (req, res) => {
  try {
    if (!req.user || req.user.email !== (process.env.ADMIN_EMAIL)) {
      return res.status(403).json({ success: false, message: "Forbidden" })
    }

    const { version, releaseNotes, downloadUrl, critical } = req.body
    if (!version || !downloadUrl) {
      return res.status(400).json({ success: false, message: "Version and download URL are required" })
    }

    const update = await AppUpdate.create({
      version,
      releaseNotes,
      downloadUrl,
      critical: !!critical,
    })

    return res.status(201).json({ success: true, update })
  } catch (error) {
    console.error("Error creating update record:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
