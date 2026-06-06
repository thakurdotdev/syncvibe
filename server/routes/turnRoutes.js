const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { generateTurnCredentials } = require("../services/turnService");

const turnRoutes = express.Router();

turnRoutes.get("/turn/credentials", authMiddleware, async (req, res) => {
  try {
    const credentials = await generateTurnCredentials();
    res.json(credentials);
  } catch (error) {
    console.error("Failed to generate TURN credentials:", error.message);
    res.status(502).json({ message: "Failed to generate TURN credentials" });
  }
});

module.exports = turnRoutes;
