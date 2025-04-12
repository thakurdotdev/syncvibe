/**
 * Socket.io manager implementation for SyncVibe
 * This file manages all WebSocket connections and events
 */

// Import handlers
const userStatusHandler = require("./handlers/userStatusHandler");
const callHandler = require("./handlers/callHandler");
const chatHandler = require("./handlers/chatHandler");
const musicGroupHandler = require("./handlers/musicGroupHandler");
const { sendPushNotification } = require("./handlers/notificationHandler");

/**
 * Initialize socket.io functionality
 * @param {Object} io - Socket.io server instance
 */
const socketManager = (io) => {
  io.on("connection", (socket) => {
    let userId;

    // Setup user connection
    socket.on("setup", (userData) => {
      try {
        userId = userData.userid;
        socket.join(userId);
        userStatusHandler.addUserSocket(userId, socket);
        console.log(`User ${userId} connected`);
      } catch (error) {
        console.error("Setup failed:", error);
        socket.emit("error", { message: "Setup failed", code: "SETUP_FAILED" });
      }
    });

    // Register handlers for different functionality categories
    userStatusHandler.registerHandlers(socket, io);
    chatHandler.registerHandlers(socket, io);
    callHandler.registerHandlers(socket, io, userId);
    musicGroupHandler.registerHandlers(socket, io, userId);

    // Disconnect handling
    socket.on("disconnect", () => {
      if (userId) {
        console.log(`User ${userId} disconnected`);

        // Handle music group updates on disconnect
        musicGroupHandler.handleDisconnect(socket, userId);

        // Handle ongoing call cleanup
        const otherUser = callHandler.cleanupCall(userId);
        if (otherUser) {
          socket.to(otherUser).emit("call-ended", {
            from: userId,
            reason: "user_disconnected",
          });
        }

        // Update online status
        userStatusHandler.notifyUserOffline(userId, io);
      }
    });
  });
};

module.exports = {
  socketManager,
};
