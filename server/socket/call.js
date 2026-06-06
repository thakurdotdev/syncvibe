const { sendPushNotification } = require("./notification");
const { saveCallEvent } = require("../services/callLogService");

const CALL_TIMEOUT = 30000;

const emitCallLog = (io, { callerId, receiverId, messagetype, duration }) => {
  saveCallEvent({ callerId, receiverId, messagetype, duration })
    .then((result) => {
      if (!result) return;
      io.to(callerId).emit("call-log", result);
      io.to(receiverId).emit("call-log", result);
    })
    .catch((err) => console.error("Call log save failed:", err));
};

const cleanupCall = (userId, context) => {
  const { activeVideoCalls, callTimeouts } = context;
  if (!activeVideoCalls.has(userId)) return null;

  const otherUser = activeVideoCalls.get(userId);
  activeVideoCalls.delete(userId);
  activeVideoCalls.delete(otherUser);

  [userId, otherUser].forEach((id) => {
    if (callTimeouts.has(id)) {
      clearTimeout(callTimeouts.get(id));
      callTimeouts.delete(id);
    }
  });

  return otherUser;
};

const createCallHandlers = (io, socket, context) => {
  const { activeVideoCalls, callTimeouts, callStartTimes, userSockets, onlineUsers } = context;

  const emitError = (code, message) => {
    socket.emit("call-error", {
      message: message || "An error occurred during the call",
      code,
    });
  };

  const requireSetup = () => {
    if (!socket.userId) {
      emitError("NOT_AUTHENTICATED", "Socket not authenticated");
      return false;
    }
    return true;
  };

  socket.on("call-user", async (data) => {
    if (!requireSetup()) return;

    try {
      const { to, offer } = data;

      if (!to || !offer) {
        return emitError("INVALID_DATA", "Missing required call data");
      }

      if (activeVideoCalls.has(socket.userId)) {
        return emitError("ALREADY_IN_CALL", "You are already in a call");
      }

      const recipientSocket = userSockets.get(to);
      if (!recipientSocket) {
        return emitError("USER_OFFLINE", "User is offline");
      }

      if (activeVideoCalls.has(to)) {
        return emitError("USER_BUSY", "User is busy on another call");
      }

      activeVideoCalls.set(socket.userId, to);
      activeVideoCalls.set(to, socket.userId);

      const timeoutId = setTimeout(() => {
        if (activeVideoCalls.has(socket.userId)) {
          cleanupCall(socket.userId, context);
          emitError("CALL_TIMEOUT", "Call not answered");
          io.to(to).emit("call-ended", {
            from: socket.userId,
            reason: "timeout",
          });

          emitCallLog(io, {
            callerId: socket.userId,
            receiverId: to,
            messagetype: "missed_call",
            duration: null,
          });
        }
      }, CALL_TIMEOUT);

      callTimeouts.set(socket.userId, timeoutId);

      socket.to(to).emit("incoming-call", {
        from: socket.userId,
        name: data.name,
        profilepic: data.profilepic,
        offer,
      });

      if (!onlineUsers.has(to)) {
        sendPushNotification(
          to,
          { name: data.name, from: socket.userId },
          "call"
        );
      }
    } catch (error) {
      console.error("call-user error:", error);
      emitError("CALL_INITIATION_FAILED", error.message);
    }
  });

  socket.on("call-accepted", (data) => {
    if (!requireSetup()) return;

    try {
      const { to, answer } = data;

      if (!to || !answer) {
        return emitError("INVALID_DATA", "Missing required answer data");
      }

      if (
        !activeVideoCalls.has(socket.userId) ||
        activeVideoCalls.get(socket.userId) !== to
      ) {
        return emitError("NO_ACTIVE_CALL", "No active call to accept");
      }

      if (callTimeouts.has(to)) {
        clearTimeout(callTimeouts.get(to));
        callTimeouts.delete(to);
      }

      const callKey = [socket.userId, to].sort().join("-");
      callStartTimes.set(callKey, Date.now());

      socket.to(to).emit("call-accepted", {
        from: socket.userId,
        name: data.name,
        profilepic: data.profilepic,
        answer,
      });
    } catch (error) {
      console.error("call-accepted error:", error);
      emitError("CALL_ACCEPT_FAILED", error.message);
    }
  });

  socket.on("call-rejected", (data) => {
    if (!requireSetup()) return;

    try {
      const otherUser = cleanupCall(socket.userId, context);
      if (otherUser) {
        socket.to(otherUser).emit("call-rejected", {
          from: socket.userId,
          reason: data?.reason,
        });

        emitCallLog(io, {
          callerId: otherUser,
          receiverId: socket.userId,
          messagetype: "rejected_call",
          duration: null,
        });
      }
    } catch (error) {
      console.error("call-rejected error:", error);
      emitError("CALL_REJECT_FAILED", error.message);
    }
  });

  socket.on("ice-candidate", (data) => {
    if (!requireSetup()) return;

    try {
      const { candidate } = data;
      if (!candidate) return;

      const targetUser = activeVideoCalls.get(socket.userId);
      if (targetUser) {
        socket.to(targetUser).emit("ice-candidate", {
          from: socket.userId,
          candidate,
        });
      }
    } catch (error) {
      console.error("ice-candidate error:", error);
    }
  });

  socket.on("ice-restart", (data) => {
    if (!requireSetup()) return;

    try {
      const { offer } = data;
      if (!offer) return;

      const targetUser = activeVideoCalls.get(socket.userId);
      if (!targetUser) return;

      socket.to(targetUser).emit("ice-restart", {
        from: socket.userId,
        offer,
      });
    } catch (error) {
      console.error("ice-restart error:", error);
      emitError("ICE_RESTART_FAILED", error.message);
    }
  });

  socket.on("ice-restart-accept", (data) => {
    if (!requireSetup()) return;

    try {
      const { answer } = data;
      if (!answer) return;

      const targetUser = activeVideoCalls.get(socket.userId);
      if (!targetUser) return;

      socket.to(targetUser).emit("ice-restart-accept", {
        from: socket.userId,
        answer,
      });
    } catch (error) {
      console.error("ice-restart-accept error:", error);
    }
  });

  socket.on("end-call", () => {
    if (!requireSetup()) return;

    try {
      const otherUser = activeVideoCalls.get(socket.userId);
      cleanupCall(socket.userId, context);

      if (otherUser) {
        socket.to(otherUser).emit("call-ended", {
          from: socket.userId,
          reason: "ended",
        });

        const callKey = [socket.userId, otherUser].sort().join("-");
        const startTime = callStartTimes.get(callKey);
        callStartTimes.delete(callKey);

        const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : null;

        emitCallLog(io, {
          callerId: socket.userId,
          receiverId: otherUser,
          messagetype: duration ? "completed_call" : "missed_call",
          duration,
        });
      }
    } catch (error) {
      console.error("end-call error:", error);
      emitError("END_CALL_FAILED", error.message);
    }
  });
};

const handleCallDisconnect = (io, userId, context) => {
  const { activeVideoCalls, callStartTimes } = context;
  const otherUser = activeVideoCalls.get(userId);
  if (!otherUser) return null;

  cleanupCall(userId, context);

  const callKey = [userId, otherUser].sort().join("-");
  const startTime = callStartTimes.get(callKey);
  callStartTimes.delete(callKey);

  const duration = startTime ? Math.round((Date.now() - startTime) / 1000) : null;

  emitCallLog(io, {
    callerId: userId,
    receiverId: otherUser,
    messagetype: duration ? "completed_call" : "missed_call",
    duration,
  });

  return otherUser;
};

module.exports = {
  cleanupCall,
  createCallHandlers,
  handleCallDisconnect,
};
