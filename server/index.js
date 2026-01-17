const http = require("http")
const { Server } = require("socket.io")
const app = require("./app")
const sequelize = require("./utils/sequelize")
const { socketManager } = require("./socket")

const server = http.createServer(app)

const io = new Server(server, {
  pingTimeout: 60000,
  connectTimeout: 45000,
  maxHttpBufferSize: 2e6,
  cors: {
    origin: [
      "https://syncvibe.thakur.dev",
      "http://localhost:5173",
      /^https:\/\/([a-z0-9-]+\.)*thakur\.dev$/,
    ],
    credentials: true,
  },
})

socketManager(io)

sequelize.authenticate().then(() => {
  const port = process.env.PORT || 4000
  server.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })
})

process.on("SIGTERM", () => {
  server.close(() => sequelize.close().finally(() => process.exit(0)))
})

process.on("uncaughtException", (err) => {
  console.error(err)
  process.exit(1)
})

process.on("unhandledRejection", (reason) => {
  console.error(reason)
})
