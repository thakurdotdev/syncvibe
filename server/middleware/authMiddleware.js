const jwt = require("jsonwebtoken");
const User = require("../models/auth/userModel");

const authMiddleware = async (req, res, next) => {
  try {
    // Check for token in cookies (web) or Authorization header (mobile)
    let token = req.cookies.token;

    // Check Authorization header if no cookie token
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const existingUser = await User.findOne({
      where: { email: decoded.email },
      raw: true,
    });

    if (!existingUser) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    req.user = existingUser;
    req.user.role = decoded.role || "user";
    next();
  } catch (error) {
    console.error("Error verifying token:", error);
    return res
      .status(401)
      .json({ error: "Unauthorized: Error verifying token" });
  }
};

module.exports = authMiddleware;
