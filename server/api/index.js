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
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const timeout = require("connect-timeout");
const hpp = require("hpp");

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

// Implement connection timeout
app.use(timeout("30s"));

// Security headers with Helmet
app.use(helmet());

// Configure CSP based on environment
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'", "https://syncvibe.xyz"],
        scriptSrc: ["'self'", "https://syncvibe.xyz"],
        imgSrc: [
          "'self'",
          "https://syncvibe.xyz",
          "https://res.cloudinary.com",
        ],
        connectSrc: ["'self'", "https://syncvibe.xyz"],
        styleSrc: ["'self'", "https://syncvibe.xyz", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://syncvibe.xyz"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    }),
  );
}

// Request logging
const logFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(
  morgan(logFormat, {
    skip: (req, res) => req.path === "/health", // Skip logging health checks
  }),
);

// API endpoints speed limiter
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 200, // allow 200 requests per 15 minutes, then...
  delayMs: (used, req) => {
    const delayAfter = req.slowDown.limit;
    return Math.min((used - delayAfter) * 500, 10000); // Max delay of 10 seconds
  },
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip;
  },
  skip: (req) => req.path === "/health", // Skip health checks
});

// Main rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: {
    status: "error",
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers["x-forwarded-for"] || req.ip;
  },
  skip: (req) => req.path === "/health", // Skip health checks
});

// Registration specific limiter
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // start blocking after 5 requests
  message: {
    status: "error",
    message:
      "Too many accounts created from this IP, please try again after an hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication routes limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: {
    status: "error",
    message: "Too many authentication attempts, please try again later",
  },
});

// API upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    status: "error",
    message: "Too many uploads from this IP, please try again later",
  },
});

// Cloudinary configuration
Cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
  secure: true, // Force https
});

// Passport configuration
app.use(passport.initialize());
require("../passport/index");

const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? [process.env.CLIENT_URL || "https://syncvibe.xyz"]
      : ["http://localhost:5173", "https://client.thakur.dev"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400, // 24 hours in seconds
};

// Middlewares
app.use(cors(corsOptions));
app.use(
  cookieParser({
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  }),
);

// Response compression
app.use(compression());

app.use(hpp());

app.use(
  express.json({
    limit: "2mb",
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ status: "error", message: "Invalid JSON" });
        throw new Error("Invalid JSON");
      }
    },
  }),
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  }),
);

app.use(limiter);
app.use(speedLimiter);

app.use("/api/register", registrationLimiter);
app.use("/api/login", authLimiter);
app.use("/api/forgot-password", authLimiter);
app.use("/api/upload", uploadLimiter);

// Basic routes
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to SyncVibe API",
    version: process.env.APP_VERSION || "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Routes with rate limiting
app.use("/api", userRouter, postRouter, chatRoutes, storyRoutes, musicRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

  // Handle timeout errors
  if (req.timedout) {
    return res.status(408).json({
      status: "error",
      message: "Request timeout",
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      status: "error",
      message: err.message,
    });
  }

  // Handle authentication errors
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized access",
    });
  }

  // Generic error handler
  return res.status(err.statusCode || 500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Syncing the database
sequelize;

// Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: corsOptions,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6, // 1MB
});

// Socket.io manager
socketManager(io);

// Starting the server
const port = process.env.PORT || 4000;
httpServer.listen(port, () => {
  console.log(
    `Server is running on port ${port} in ${
      process.env.NODE_ENV || "development"
    } mode`,
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  httpServer.close(() => {
    console.log("HTTP server closed");
    // Close database connections
    sequelize
      .close()
      .then(() => {
        console.log("Database connections closed");
        process.exit(0);
      })
      .catch((err) => {
        console.error("Error closing database", err);
        process.exit(1);
      });
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 30000);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  // Log to external service in production
  if (process.env.NODE_ENV === "production") {
    // Your logging service code here
  }

  // In production, you might want to restart the process
  // with a process manager like PM2 rather than exit
  if (process.env.NODE_ENV !== "production") {
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // Log to external service in production
  if (process.env.NODE_ENV === "production") {
    // Your logging service code here
  }
});

module.exports = app;
