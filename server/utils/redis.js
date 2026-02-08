const Redis = require("ioredis")

let redis = null

const getRedis = () => {
  if (!redis) {
    const url = process.env.REDIS_URL
    if (!url) {
      console.warn("REDIS_URL not set, using in-memory fallback")
      return null
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    })
    redis.on("error", (err) => console.error("Redis error:", err.message))
    redis.on("connect", () => console.log("Redis connected"))
  }
  return redis
}

const cache = {
  async get(key) {
    const client = getRedis()
    if (!client) return null
    try {
      const data = await client.get(key)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  },

  async set(key, value, ttlSeconds = 300) {
    const client = getRedis()
    if (!client) return false
    try {
      await client.setex(key, ttlSeconds, JSON.stringify(value))
      return true
    } catch {
      return false
    }
  },

  async del(key) {
    const client = getRedis()
    if (!client) return false
    try {
      await client.del(key)
      return true
    } catch {
      return false
    }
  },

  async delPattern(pattern) {
    const client = getRedis()
    if (!client) return false
    try {
      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(...keys)
      }
      return true
    } catch {
      return false
    }
  },
}

module.exports = { getRedis, cache }
