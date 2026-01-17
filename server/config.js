const { configDotenv } = require("dotenv")
const Cloudinary = require("cloudinary").v2
const rateLimit = require("express-rate-limit")
const slowDown = require("express-slow-down")
const helmet = require("helmet")

configDotenv()

const security =
  process.env.NODE_ENV === "production"
    ? helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'", "https://syncvibe.thakur.dev"],
            scriptSrc: ["'self'", "https://syncvibe.thakur.dev"],
            styleSrc: ["'self'", "https://syncvibe.thakur.dev", "'unsafe-inline'"],
            imgSrc: ["'self'", "https://syncvibe.thakur.dev", "https://res.cloudinary.com"],
            connectSrc: ["'self'", "https://syncvibe.thakur.dev", "https://api.cloudinary.com"],
            objectSrc: ["'none'"],
          },
        },
      })
    : helmet()

Cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true,
})

const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 200,
  delayMs: (used, req) => Math.min((used - req.slowDown.limit) * 500, 10000),
  keyGenerator: (req) => req.ip,
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
})

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
})

module.exports = {
  security,
  apiLimiter,
  speedLimiter,
  authLimiter,
  uploadLimiter,
}
