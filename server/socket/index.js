const {
  setupGroupMusicHandlers,
  handleUserDisconnect,
} = require("./groupMusic");
const { setSocketIO } = require("../utils/socketEmitter");
const { setupChatHandlers } = require("./chat");
const { setupOnlineHandlers } = require("./online");
const { createCallHandlers, handleCallDisconnect } = require("./call");

const socketManager = (io) => {
  const userSockets = new Map();
  const onlineUsers = new Set();
  const activeVideoCalls = new Map();
  const callTimeouts = new Map();
  const callStartTimes = new Map();

  setSocketIO(io, userSockets);

  const context = {
    userSockets,
    onlineUsers,
    activeVideoCalls,
    callTimeouts,
    callStartTimes,
  };

  io.on("connection", (socket) => {
    socket.on("setup", (userData) => {
      try {
        if (!userData?.userid) {
          socket.emit("socket-error", {
            message: "Invalid setup data",
            code: "SETUP_FAILED",
          });
          return;
        }

        const userId = userData.userid;
        socket.userId = userId;
        socket.join(userId);
        userSockets.set(userId, socket);

        if (!socket.musicHandlersSetup) {
          setupGroupMusicHandlers(io, socket, userId, userSockets);
          socket.musicHandlersSetup = true;
        }

        socket.emit("setup-complete");
      } catch (error) {
        console.error("Setup error:", error);
        socket.emit("socket-error", {
          message: "Setup failed",
          code: "SETUP_FAILED",
        });
      }
    });

    setupChatHandlers(io, socket, context);
    setupOnlineHandlers(io, socket, context);
    createCallHandlers(io, socket, context);

    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (!userId) return;

      handleUserDisconnect(io, userId, userSockets);

      const otherUser = handleCallDisconnect(io, userId, context);
      if (otherUser) {
        io.to(otherUser).emit("call-ended", {
          from: userId,
          reason: "user_disconnected",
        });
      }

      userSockets.delete(userId);
      onlineUsers.delete(userId);
      io.emit("user_offline", userId);
    });
  });
};

module.exports = {
  socketManager,
};
