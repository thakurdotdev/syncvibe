// Force IPv4 first (critical for Render)
const dns = require("dns")
dns.setDefaultResultOrder("ipv4first")

const { configDotenv } = require("dotenv")
const Sequelize = require("sequelize")

configDotenv()

// Connection pool configuration
const poolConfig = {
  max: 20,
  min: 5,
  idle: 10000,
  acquire: 30000,
  evict: 30000,
}

// IMPORTANT: For Supabase pooler, use DATABASE_URL instead of separate params
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  logging: false,

  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // ← FIX self-signed cert error
    },
  },

  pool: poolConfig,

  retry: {
    max: 3,
    match: [
      /ConnectionError/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /TimeoutError/,
    ],
  },
})

// Retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
  let retryCount = 0

  while (retryCount < retries) {
    try {
      await sequelize.authenticate()
      console.log("Database Connected Successfully")
      return
    } catch (err) {
      retryCount++
      console.error(`Connection attempt ${retryCount} failed:`, err.message)

      if (retryCount >= retries) {
        console.error("Maximum retry attempts reached. Cannot connect to database.")
        throw err
      }

      console.log(`Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

// Start connection
connectWithRetry().catch((err) => {
  console.error("Fatal database connection error:", err)
  process.exit(1)
})

// Clean shutdown
process.on("SIGINT", async () => {
  try {
    await sequelize.close()
    console.log("Database connection closed due to app termination")
    process.exit(0)
  } catch (error) {
    console.error("Error during database disconnection:", error)
    process.exit(1)
  }
})

module.exports = sequelize
