const jwt = require('jsonwebtoken');
const User = require('../models/auth/userModel');

// Simple in-memory cache with TTL
const userCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds

// Clean up expired cache entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
      if (now > value.expiresAt) {
        userCache.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

const authMiddleware = async (req, res, next) => {
  try {
    // Check for token in cookies (web) or Authorization header (mobile)
    let token = req.cookies?.token;

    // Check Authorization header if no cookie token
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const cacheKey = decoded.email;
    const now = Date.now();

    // Check if user is in cache and not expired
    if (userCache.has(cacheKey) && userCache.get(cacheKey).expiresAt > now) {
      req.user = userCache.get(cacheKey).user;
      req.user.role = decoded.role || 'user';
      return next();
    }

    // User not in cache or cache expired, fetch from DB
    const existingUser = await User.findOne({
      where: { email: decoded.email },
      raw: true,
    });

    if (!existingUser) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    // Update cache with user data
    userCache.set(cacheKey, {
      user: existingUser,
      expiresAt: now + CACHE_TTL,
    });

    req.user = existingUser;
    req.user.role = decoded.role || 'user';
    next();
  } catch (error) {
    console.error('Error verifying token:', error);
    return res.status(401).json({ error: 'Unauthorized: Error verifying token' });
  }
};

module.exports = authMiddleware;
