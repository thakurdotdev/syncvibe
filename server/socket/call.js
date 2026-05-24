const { sendPushNotification } = require("./notification");

const CALL_TIMEOUT = 30000;

const cleanupCall = (userId, context) => {
  const { activeVideoCalls, callTimeouts } = context;
  if (activeVideoCalls.has(userId)) {
    const otherUser = activeVideoCalls.get(userId);
    activeVideoCalls.delete(userId);
    activeVideoCalls.delete(otherUser);

    if (callTimeouts.has(userId)) {
      clearTimeout(callTimeouts.get(userId));
      callTimeouts.delete(userId);
    }
    if (callTimeouts.has(otherUser)) {
      clearTimeout(callTimeouts.get(otherUser));
      callTimeouts.delete(otherUser);
    }

    return otherUser;
  }
  return null;
};

const createCallHandlers = (io, socket, context) => {
  const { activeVideoCalls, callTimeouts, userSockets, onlineUsers } = context;

  const handleCallError = (error, code) => {
    console.error(`Call error (${code}):`, error);
    socket.emit("call-error", {
      message: error.message || "An error occurred during the call",
      code,
    });
  };

  socket.on("call-user", async (data) => {
    try {
      const { to, from, name, profilepic, offer } = data;
      const recipientSocket = userSockets.get(to);
      if (!recipientSocket) {
        throw new Error("User is offline");
      }

      if (activeVideoCalls.has(to)) {
        throw new Error("User is busy");
      }

      activeVideoCalls.set(from, to);
      activeVideoCalls.set(to, from);

      const timeoutId = setTimeout(() => {
        if (activeVideoCalls.has(from)) {
          cleanupCall(from, context);
          socket.emit("call-error", {
            message: "Call not answered",
            code: "CALL_TIMEOUT",
          });
          socket.to(to).emit("call-ended", {
            from,
            reason: "timeout",
          });
        }
      }, CALL_TIMEOUT);

      callTimeouts.set(from, timeoutId);

      socket.to(to).emit("incoming-call", {
        from,
        name,
        profilepic,
        offer,
      });

      if (!onlineUsers.has(to)) {
        sendPushNotification(to, { name, from }, "call");
      }
    } catch (error) {
      handleCallError(error, "CALL_INITIATION_FAILED");
    }
  });

  socket.on("call-accepted", (data) => {
    try {
      const { to, name, profilepic, answer } = data;

      if (callTimeouts.has(to)) {
        clearTimeout(callTimeouts.get(to));
        callTimeouts.delete(to);
      }

      socket.to(to).emit("call-accepted", {
        from: socket.userId,
        name,
        profilepic,
        answer,
      });
    } catch (error) {
      handleCallError(error, "CALL_ACCEPT_FAILED");
    }
  });

  socket.on("call-rejected", (data) => {
    try {
      const { to, reason } = data;
      const otherUser = cleanupCall(socket.userId, context);

      if (otherUser) {
        socket.to(to).emit("call-rejected", {
          from: socket.userId,
          reason,
        });
      }
    } catch (error) {
      handleCallError(error, "CALL_REJECT_FAILED");
    }
  });

  socket.on("ice-candidate", (data) => {
    try {
      const { to, candidate } = data;

      if (
        activeVideoCalls.has(socket.userId) &&
        activeVideoCalls.get(socket.userId) === to
      ) {
        socket.to(to).emit("ice-candidate", {
          from: socket.userId,
          candidate,
        });
      }
    } catch (error) {
      handleCallError(error, "ICE_CANDIDATE_FAILED");
    }
  });

  socket.on("end-call", (data) => {
    try {
      const { to } = data;
      const otherUser = cleanupCall(socket.userId, context);

      if (otherUser) {
        socket.to(to).emit("call-ended", {
          from: socket.userId,
        });
      }
    } catch (error) {
      handleCallError(error, "END_CALL_FAILED");
    }
  });
};

module.exports = {
  cleanupCall,
  createCallHandlers,
};
