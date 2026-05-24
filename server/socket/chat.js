const { sendPushNotification } = require("./notification");

const setupChatHandlers = (io, socket, context) => {
  const { userSockets, onlineUsers } = context;

  socket.on("join-chat", (room) => {
    try {
      socket.join(room);
    } catch (error) {
      console.error("Join chat failed:", error);
      socket.emit("call-error", {
        message: error.message || "An error occurred during the call",
        code: "JOIN_CHAT_FAILED",
      });
    }
  });

  socket.on("new-message", (messageData) => {
    try {
      const { senderid, participants } = messageData;
      const recipientId = participants.find(
        (participant) => participant !== senderid,
      );
      const recipientSocket = userSockets.get(recipientId);
      const isRecipientOnline = recipientSocket && onlineUsers.has(recipientId);

      if (!isRecipientOnline) {
        sendPushNotification(recipientId, messageData);
        return;
      }
      socket.to(recipientId).emit("message-received", messageData);
    } catch (error) {
      console.error("Message failed:", error);
      socket.emit("call-error", {
        message: error.message || "An error occurred during the call",
        code: "MESSAGE_FAILED",
      });
    }
  });

  socket.on("delete-message", (messageData) => {
    try {
      const { recipientId } = messageData;
      socket.to(recipientId).emit("message-deleted", messageData);
    } catch (error) {
      console.error("Delete message failed:", error);
      socket.emit("call-error", {
        message: error.message || "An error occurred during the call",
        code: "DELETE_MESSAGE_FAILED",
      });
    }
  });

  socket.on("typing", (data) => {
    try {
      const { userId, recipientId, isTyping } = data;
      socket.to(recipientId).emit("typing_status", { userId, isTyping });
    } catch (error) {
      console.error("Typing status failed:", error);
      socket.emit("call-error", {
        message: error.message || "An error occurred during the call",
        code: "TYPING_STATUS_FAILED",
      });
    }
  });

  socket.on("messages-read", (data) => {
    try {
      const { messageIds, chatid, readerId, senderId } = data;
      socket.to(senderId).emit("messages-read-status", {
        messageIds,
        chatid,
        readerId,
      });
    } catch (error) {
      console.error("Message read status failed:", error);
      socket.emit("call-error", {
        message: error.message || "An error occurred during the call",
        code: "MESSAGE_READ_STATUS_FAILED",
      });
    }
  });
};

module.exports = {
  setupChatHandlers,
};
