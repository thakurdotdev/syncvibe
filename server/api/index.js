const express = require("express");
const { configDotenv } = require("dotenv");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const passport = require("passport");
const Cloudinary = require("cloudinary").v2;
const { createServer } = require("http");
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

const sequelize = require("../utils/sequelize");
const socketManager = require("../socket/index");
const userRouter = require("../routes/userRoutes");
const postRouter = require("../routes/postRoutes");
const chatRoutes = require("../routes/chatRoutes");
const storyRoutes = require("../routes/storyRoutes");
const musicRoutes = require("../routes/musicRoutes");

// Configuring the environment variables
configDotenv();

const app = express();

// Enable if you're behind a reverse proxy (Heroku, Bluemix, AWS ELB, Nginx, etc)
app.set("trust proxy", 1);

// API endpoints speed limiter with fixed configuration
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 200, // allow 100 requests per 15 minutes, then...
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return (used - delayAfter) * 500;
  }, // calculate delay using old behavior
  // Or alternatively, for simpler fixed delay:
  // delayMs: () => 500,
});

// Rate limiters
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: "Too many requests from this IP, please try again later",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Registration specific limiter
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // start blocking after 5 requests
  message:
    "Too many accounts created from this IP, please try again after an hour",
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication routes limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: "Too many authentication attempts, please try again later",
});

// Cloudinary configuration
Cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// Passport configuration
app.use(passport.initialize());
require("../passport/index");

const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? ["https://syncvibe.xyz"]
      : ["http://localhost:5173", "https://client.thakur.dev"],
  credentials: true,
};

// Middlewares
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Apply general rate limiting to all requests
app.use(limiter);
app.use(speedLimiter);

// Apply specific rate limits to auth routes
app.use("/api/register", registrationLimiter);
app.use("/api/login", authLimiter);
app.use("/api/forgot-password", authLimiter);

// Routes with rate limiting
app.use("/api", userRouter, postRouter, chatRoutes, storyRoutes, musicRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof Error) {
    return res.status(500).json({
      status: "error",
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
    });
  }
  next(err);
});

// Syncing the database
sequelize;

// Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: corsOptions,
});

// Socket.io manager
socketManager(io);

// Starting the server
const port = process.env.PORT || 4000;
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
