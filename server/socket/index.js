const {
  setupGroupMusicHandlers,
  handleUserDisconnect,
} = require("./groupMusic");
const { setSocketIO } = require("../utils/socketEmitter");
const { setupChatHandlers } = require("./chat");
const { setupOnlineHandlers } = require("./online");
const { createCallHandlers, cleanupCall } = require("./call");

const socketManager = (io) => {
  const userSockets = new Map();
  const onlineUsers = new Set();
  const activeVideoCalls = new Map();
  const callTimeouts = new Map();

  setSocketIO(io, userSockets);

  const context = {
    userSockets,
    onlineUsers,
    activeVideoCalls,
    callTimeouts,
  };

  const handleCallError = (socket, error, code) => {
    console.error(`Call error (${code}):`, error);
    socket.emit("call-error", {
      message: error.message || "An error occurred during the call",
      code,
    });
  };

  const notifyUserOffline = (userId) => {
    userSockets.delete(userId);
    onlineUsers.delete(userId);
    io.emit("user_offline", userId);
  };

  io.on("connection", (socket) => {
    let userId;

    socket.on("setup", (userData) => {
      try {
        userId = userData.userid;
        socket.userId = userId;
        socket.join(userId);
        userSockets.set(userId, socket);
        console.log(`User ${userId} connected`);

        if (!socket.musicHandlersSetup) {
          setupGroupMusicHandlers(io, socket, userId, userSockets);
          socket.musicHandlersSetup = true;
        }

        socket.emit("setup-complete");
      } catch (error) {
        handleCallError(socket, error, "SETUP_FAILED");
      }
    });

    setupChatHandlers(io, socket, context);
    setupOnlineHandlers(io, socket, context);
    createCallHandlers(io, socket, context);

    socket.on("disconnect", () => {
      if (userId) {
        console.log(`User ${userId} disconnected`);

        handleUserDisconnect(io, userId, userSockets);

        const otherUser = cleanupCall(userId, context);
        if (otherUser) {
          socket.to(otherUser).emit("call-ended", {
            from: userId,
            reason: "user_disconnected",
          });
        }

        notifyUserOffline(userId);
      }
    });
  });
};

module.exports = {
  socketManager,
};
