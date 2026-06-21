const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const { Readable } = require("node:stream")
const { S3Client } = require("@aws-sdk/client-s3")
const { Upload } = require("@aws-sdk/lib-storage")
const { NodeHttpHandler } = require("@smithy/node-http-handler")
const AppUpdate = require("../models/appUpdateModel")
const { getRedis, cache } = require("../utils/redis")

const s3Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  maxAttempts: 5,
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 10_000,
    socketTimeout: 120_000,
  }),
})

const MAX_UPLOAD_ATTEMPTS = 3

const uploadToR2WithRetry = async (tempFilePath, fileKey, attempt = 1) => {
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
        Body: fs.createReadStream(tempFilePath),
        ContentType: "application/vnd.android.package-archive",
      },
      queueSize: 4,
      partSize: 10 * 1024 * 1024, // 10MB parts
      leavePartsOnError: false,
    })

    await upload.done()
  } catch (error) {
    if (attempt < MAX_UPLOAD_ATTEMPTS) {
      const backoffMs = attempt * 2000
      console.warn(
        `R2 upload attempt ${attempt} failed (${error.message}), retrying in ${backoffMs}ms...`
      )
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
      return uploadToR2WithRetry(tempFilePath, fileKey, attempt + 1)
    }
    throw error
  }
}

const processUpdateInBackground = async (version, artifacts, metadata, releaseNotes) => {
  let tempFilePath = null
  try {
    console.log(`Processing app update v${version} in background`)
    const existingUpdate = await AppUpdate.findOne({ where: { version } })
    if (existingUpdate) {
      await cache.del(`pending-update:${version}`)
      return
    }

    const response = await fetch(artifacts.buildUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch artifact: ${response.statusText}`)
    }

    tempFilePath = path.join(__dirname, `temp-${version}.apk`)
    const fileStream = fs.createWriteStream(tempFilePath)

    await new Promise((resolve, reject) => {
      Readable.fromWeb(response.body)
        .pipe(fileStream)
        .on("finish", resolve)
        .on("error", reject)
    })

    console.log(`Downloaded app update v${version} to temp file: ${tempFilePath}`)

    console.log(`Uploading app update v${version} to R2`)

    const fileKey = `updates/syncvibe-v${version}.apk`
    await uploadToR2WithRetry(tempFilePath, fileKey)

    console.log(`Uploaded app update v${version} to R2 at key: ${fileKey}`)

    const downloadUrl = `${process.env.R2_PUBLIC_URL}/${fileKey}`

    await AppUpdate.create({
      version,
      releaseNotes,
      downloadUrl,
      critical: false,
    })

    console.log(`Automatically published app update v${version} via EAS Webhook`)
    await cache.del(`pending-update:${version}`)
  } catch (error) {
    console.error(`EAS Webhook background processing failed for v${version}:`, error)
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, (err) => {
        if (err) {
          console.error("Failed to delete temp file:", err)
        }
      })
    }
  }
}

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

      const isQueued = await cache.get(`pending-update:${version}`)
      if (isQueued) {
        return res.status(202).json({ success: true, message: "Update processing already in progress" })
      }

      await cache.set(`pending-update:${version}`, { artifacts, metadata, releaseNotes }, 86400)

      res.status(202).json({ success: true, message: "Update processing initiated in background" })

      processUpdateInBackground(version, artifacts, metadata, releaseNotes)

      return
    }

    return res.status(200).json({ success: true, message: "Webhook received (no action taken)" })
  } catch (error) {
    console.error("EAS Webhook processing failed:", error)
    return res.status(500).json({ success: false, message: error.message })
  }
}

exports.resumePendingUpdates = async () => {
  try {
    const redisClient = getRedis()
    if (!redisClient) return

    const keys = await redisClient.keys("pending-update:*")
    if (keys.length === 0) return

    console.log(`Found ${keys.length} pending app updates in Redis. Resuming...`)

    for (const key of keys) {
      const version = key.split(":")[1]
      const data = await cache.get(key)
      if (!data) continue

      const { artifacts, metadata, releaseNotes } = data
      processUpdateInBackground(version, artifacts, metadata, releaseNotes)
    }
  } catch (error) {
    console.error("Failed to resume pending app updates from Redis:", error)
  }
}