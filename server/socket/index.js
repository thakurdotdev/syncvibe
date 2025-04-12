const { Expo } = require("expo-server-sdk");
const { getPushToken } = require("../controllers/auth/loginUser");
const QRCode = require("qrcode");

const expo = new Expo();

async function sendPushNotification(recipientId, message, type = "message") {
  if (!recipientId) return;

  const recipientToken = await getPushToken(recipientId);
  if (!recipientToken) return;

  let notification;

  if (type === "message") {
    notification = {
      to: recipientToken,
      sound: "default",
      title: `New message from ${message.senderName}`,
      body: message.content || "Sent an attachment",
      data: { chatid: message.chatid },
    };
  } else if (type === "call") {
    notification = {
      to: recipientToken,
      sound: "default",
      title: `Incoming call from ${message.name}`,
      body: "Tap to open the app",
      data: { callFrom: message.from, callType: "video" },
      priority: "high",
    };
  }

  try {
    await expo.sendPushNotificationsAsync([notification]);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

const socketManager = (io) => {
  // Track user connections and call states
  const userSockets = new Map();
  const onlineUsers = new Set();
  const activeVideoCalls = new Map();
  const callTimeouts = new Map();

  // Music group state
  const musicGroups = new Map();

  const CALL_TIMEOUT = 30000; // 30 seconds timeout for unanswered calls

  // Utility functions
  const cleanupCall = (userId) => {
    if (activeVideoCalls.has(userId)) {
      const otherUser = activeVideoCalls.get(userId);
      activeVideoCalls.delete(userId);
      activeVideoCalls.delete(otherUser);

      // Clear any pending call timeouts
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

    // Setup user connection
    socket.on("setup", (userData) => {
      try {
        userId = userData.userid;
        socket.join(userId);
        userSockets.set(userId, socket);
        console.log(`User ${userId} connected`);
      } catch (error) {
        handleCallError(socket, error, "SETUP_FAILED");
      }
    });

    // Chat room management
    socket.on("join-chat", (room) => {
      try {
        socket.join(room);
      } catch (error) {
        handleCallError(socket, error, "JOIN_CHAT_FAILED");
      }
    });

    // Message handling
    socket.on("new-message", (messageData) => {
      try {
        const { senderid, participants } = messageData;
        const recipientId = participants.find(
          (participant) => participant !== senderid,
        );
        const recipientSocket = userSockets.get(recipientId);
        const isRecipientOnline =
          recipientSocket && onlineUsers.has(recipientId);

        if (!isRecipientOnline) {
          sendPushNotification(recipientId, messageData);
          return;
        }
        socket.to(recipientId).emit("message-received", messageData);
      } catch (error) {
        handleCallError(socket, error, "MESSAGE_FAILED");
      }
    });

    socket.on("delete-message", (messageData) => {
      try {
        const { recipientId } = messageData;
        socket.to(recipientId).emit("message-deleted", messageData);
      } catch (error) {
        handleCallError(socket, error, "DELETE_MESSAGE_FAILED");
      }
    });

    // Typing status
    socket.on("typing", (data) => {
      try {
        const { userId, recipientId, isTyping } = data;
        socket.to(recipientId).emit("typing_status", { userId, isTyping });
      } catch (error) {
        handleCallError(socket, error, "TYPING_STATUS_FAILED");
      }
    });

    // Video call signaling
    socket.on("call-user", async (data) => {
      try {
        const { to, from, name, profilepic, offer } = data;

        // Validate call possibility
        const recipientSocket = userSockets.get(to);
        if (!recipientSocket) {
          throw new Error("User is offline");
        }

        if (activeVideoCalls.has(to)) {
          throw new Error("User is busy");
        }

        // Setup call tracking
        activeVideoCalls.set(from, to);
        activeVideoCalls.set(to, from);

        // Set timeout for unanswered calls
        const timeoutId = setTimeout(() => {
          if (activeVideoCalls.has(from)) {
            cleanupCall(from);
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

        // Notify recipient
        socket.to(to).emit("incoming-call", {
          from,
          name,
          profilepic,
          offer,
        });

        // Send push notification if recipient is offline
        if (!onlineUsers.has(to)) {
          sendPushNotification(to, { name, from }, "call");
        }
      } catch (error) {
        handleCallError(socket, error, "CALL_INITIATION_FAILED");
      }
    });

    socket.on("call-accepted", (data) => {
      try {
        const { to, name, profilepic, answer } = data;

        // Clear call timeout since call was answered
        if (callTimeouts.has(to)) {
          clearTimeout(callTimeouts.get(to));
          callTimeouts.delete(to);
        }

        socket.to(to).emit("call-accepted", {
          from: userId,
          name,
          profilepic,
          answer,
        });
      } catch (error) {
        handleCallError(socket, error, "CALL_ACCEPT_FAILED");
      }
    });

    socket.on("call-rejected", (data) => {
      try {
        const { to, reason } = data;
        const otherUser = cleanupCall(userId);

        if (otherUser) {
          socket.to(to).emit("call-rejected", {
            from: userId,
            reason,
          });
        }
      } catch (error) {
        handleCallError(socket, error, "CALL_REJECT_FAILED");
      }
    });

    socket.on("ice-candidate", (data) => {
      try {
        const { to, candidate } = data;

        // Only forward ICE candidates if call is still active
        if (
          activeVideoCalls.has(userId) &&
          activeVideoCalls.get(userId) === to
        ) {
          socket.to(to).emit("ice-candidate", {
            from: userId,
            candidate,
          });
        }
      } catch (error) {
        handleCallError(socket, error, "ICE_CANDIDATE_FAILED");
      }
    });

    socket.on("end-call", (data) => {
      try {
        const { to } = data;
        const otherUser = cleanupCall(userId);

        if (otherUser) {
          socket.to(to).emit("call-ended", {
            from: userId,
          });
        }
      } catch (error) {
        handleCallError(socket, error, "END_CALL_FAILED");
      }
    });

    // Online status management
    socket.on("user_online", (userId) => {
      onlineUsers.add(userId);
      io.emit("user_online", userId);
    });

    socket.on("get_initial_online_users", () => {
      socket.emit("initial_online_users", Array.from(onlineUsers));
    });

    /////////////////////////////
    //Music Group /////////////////////////////
    /////////////////////////////

    socket.on("time-sync-request", (data) => {
      socket.emit("time-sync-response", {
        clientTime: data.clientTime,
        serverTime: Date.now(),
      });
    });

    socket.on("get-music-groups", () => {
      socket.emit("music-groups", Array.from(musicGroups.values()));
    });

    socket.on("create-music-group", async (data) => {
      let groupId = Math.floor(100000 + Math.random() * 900000).toString();
      groupId = "syncvibe_" + groupId; // Prefix with 'syncvibe_'
      const newGroup = {
        id: groupId,
        name: data.name,
        createdBy: data.createdBy,
        members: [
          {
            userId: data.createdBy,
            userName: data.userName,
            profilePic: data.profilePic,
          },
        ],
        playbackState: {
          isPlaying: false,
          currentTime: 0,
          currentTrack: null,
          lastUpdate: Date.now(),
        },
      };

      try {
        const qrCodeBuffer = await QRCode.toBuffer(groupId, {
          errorCorrectionLevel: "H",
          scale: 10,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });

        musicGroups.set(groupId, {
          ...newGroup,
          qrCode: qrCodeBuffer.toString("base64"),
        });
        socket.join(`music-group-${groupId}`);

        io.to(data.createdBy).emit("group-created", {
          ...newGroup,
          qrCode: qrCodeBuffer.toString("base64"),
        });
      } catch (err) {
        console.error("QR Code Generation Failed:", err);
        socket.emit("error", { message: "QR Code generation failed" });
      }
    });

    socket.on("join-music-group", (data) => {
      const group = musicGroups.get(data.groupId);

      if (group) {
        socket.join(`music-group-${data.groupId}`);
        group.members.push({
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });

        socket.emit("group-joined", {
          group,
          members: group.members,
          playbackState: group.playbackState,
        });

        socket.to(`music-group-${data.groupId}`).emit("member-joined", {
          userId: data.userId,
          userName: data.userName,
          profilePic: data.profilePic,
        });
      } else {
        io.to(userId).emit("group-not-found");
      }
    });

    socket.on("music-change", (data) => {
      const { groupId, song, currentTime, scheduledTime } = data;

      const group = musicGroups.get(groupId);
      if (!group) {
        return;
      }

      group.playbackState = {
        currentTime,
        currentTrack: song,
        lastUpdate: Date.now(),
      };
      // Broadcast to all members in the group
      socket.to(`music-group-${groupId}`).emit("music-update", {
        song,
        currentTime,
        scheduledTime,
      });
    });

    socket.on("music-playback", (data) => {
      const group = musicGroups.get(data.groupId);
      if (group) {
        group.playbackState = {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          lastUpdate: Date.now(),
        };

        io.to(`music-group-${data.groupId}`).emit("playback-update", {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          scheduledTime: data.scheduledTime,
        });
      }
    });

    socket.on("music-seek", (data) => {
      const group = musicGroups.get(data.groupId);
      if (group) {
        group.playbackState = {
          ...group.playbackState,
          currentTime: data.currentTime,
          lastUpdate: Date.now(),
        };

        io.to(`music-group-${data.groupId}`).emit("playback-update", {
          isPlaying: data.isPlaying,
          currentTime: data.currentTime,
          scheduledTime: data.scheduledTime,
        });
      }
    });

    socket.on("leave-group", (data) => {
      const group = musicGroups.get(data.groupId);
      if (group) {
        group.members = group.members.filter(
          (member) => member.userId !== data.userId,
        );

        socket.to(`music-group-${data.groupId}`).emit("member-left", {
          userId: data.userId,
        });

        if (group.members.length === 0) {
          musicGroups.delete(data.groupId);
          socket.to(`music-group-${data.groupId}`).emit("group-disbanded");
        }
      }
    });

    socket.on("chat-message", (data) => {
      const { groupId } = data;
      io.to(`music-group-${groupId}`).emit("new-message", data);
    });

    // Handle messages marked as read
    socket.on("messages-read", (data) => {
      try {
        const { messageIds, chatid, readerId, senderId } = data;

        // Notify the message sender that their messages have been read
        socket.to(senderId).emit("messages-read-status", {
          messageIds,
          chatid,
          readerId,
        });
      } catch (error) {
        handleCallError(socket, error, "MESSAGE_READ_STATUS_FAILED");
      }
    });

    // Disconnect handling
    socket.on("disconnect", () => {
      if (userId) {
        console.log(`User ${userId} disconnected`);

        const groupIds = Array.from(musicGroups.keys()).filter((groupId) =>
          socket.rooms.has(`music-group-${groupId}`),
        );

        groupIds.forEach((groupId) => {
          socket.to(`music-group-${groupId}`).emit("member-left", {
            userId,
          });
        });

        // Handle ongoing call cleanup
        const otherUser = cleanupCall(userId);
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
