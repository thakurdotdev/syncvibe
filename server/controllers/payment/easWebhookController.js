const crypto = require("crypto")
const axios = require("axios")
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3")
const AppUpdate = require("../../models/appUpdateModel")

exports.handleEasWebhook = async (req, res) => {
  try {
    const signature = req.headers["expo-signature"]
    const secret = process.env.EAS_WEBHOOK_SECRET

    let payload = req.body
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString())
    }

    if (secret && signature) {
      const hmac = crypto.createHmac("sha1", secret)
      const dataToSign = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body)
      hmac.update(dataToSign)
      const calculated = `sha1=${hmac.digest("hex")}`
      if (signature !== calculated) {
        return res.status(401).json({ success: false, message: "Invalid signature" })
      }
    }

    const { status, platform, artifacts, metadata } = payload

    if (status === "finished" && platform === "android" && artifacts?.buildUrl) {
      const version = metadata?.appVersion
      const releaseNotes = metadata?.gitCommitMessage || "New build uploaded automatically."

      if (!version) {
        return res.status(400).json({ success: false, message: "Version missing in metadata" })
      }

      const existingUpdate = await AppUpdate.findOne({ where: { version } })
      if (existingUpdate) {
        return res.status(200).json({ success: true, message: "Version already exists" })
      }

      const apkResponse = await axios.get(artifacts.buildUrl, { responseType: "arraybuffer" })
      const apkBuffer = Buffer.from(apkResponse.data)

      const s3Client = new S3Client({
        region: "auto",
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })

      const fileKey = `updates/syncvibe-v${version}.apk`
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: apkBuffer,
        ContentType: "application/vnd.android.package-archive",
      }))

      const downloadUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`

      const update = await AppUpdate.create({
        version,
        releaseNotes,
        downloadUrl,
        critical: false,
      })

      console.log(`Automatically published app update v${version} via EAS Webhook`)
      return res.status(200).json({ success: true, update })
    }

    return res.status(200).json({ success: true, message: "Webhook received (no action taken)" })
  } catch (error) {
    console.error("EAS Webhook processing failed:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}
