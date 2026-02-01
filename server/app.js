const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const compression = require("compression")
const passport = require("passport")
const timeout = require("connect-timeout")
const hpp = require("hpp")

const { security, apiLimiter, speedLimiter, authLimiter, uploadLimiter } = require("./config")

const userRouter = require("./routes/userRoutes")
const postRouter = require("./routes/postRoutes")
const chatRoutes = require("./routes/chatRoutes")
const storyRoutes = require("./routes/storyRoutes")
const musicRoutes = require("./routes/musicRoutes")
const uploadRoutes = require("./routes/uploadRoutes")
const webhookRoutes = require("./routes/webhookRoutes")
const paymentRoutes = require("./routes/paymentRoutes")

require("./passport")

const app = express()

app.set("trust proxy", 1)

app.use(timeout("30s"))
app.use(security)

app.use(
  cors({
    origin: (origin, cb) => {
      if (
        !origin ||
        origin === "https://syncvibe.thakur.dev" ||
        origin === "http://localhost:5173" ||
        /^https:\/\/([a-z0-9-]+\.)*thakur\.dev$/.test(origin)
      ) {
        cb(null, true)
      } else {
        cb(new Error("Blocked by CORS"))
      }
    },
    credentials: true,
  }),
)

app.use(cookieParser())
app.use(compression())
app.use(hpp())

app.use("/api", webhookRoutes)

app.use(
  express.json({
    limit: "2mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf)
      } catch {
        res.status(400).json({ message: "Invalid JSON" })
      }
    },
  }),
)

app.use(express.urlencoded({ extended: true, limit: "2mb" }))

app.use(speedLimiter)
app.use(apiLimiter)

app.use("/api/login", authLimiter)
app.use("/api/register", authLimiter)
app.use("/api/forgot-password", authLimiter)
app.use("/api/upload", uploadLimiter, timeout("60s"))

app.use(passport.initialize())

app.get("/health", (_, res) => res.json({ status: "ok" }))

app.use(
  "/api",
  userRouter,
  postRouter,
  chatRoutes,
  storyRoutes,
  musicRoutes,
  uploadRoutes,
  paymentRoutes,
)

app.use((err, req, res, next) => {
  if (req.timedout) {
    return res.status(408).json({ message: "Request timeout" })
  }

  res.status(err.statusCode || 500).json({
    message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  })
})

module.exports = app
