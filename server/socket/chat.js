const { sendPushNotification } = require("./notification");

const setupChatHandlers = (io, socket, context) => {
  const { userSockets, onlineUsers } = context;

  socket.on("join-chat", (room) => {
    if (!room || !socket.userId) return;
    socket.join(room);
  });

  socket.on("new-message", (messageData) => {
    if (!socket.userId) return;

    try {
      const { senderid, participants } = messageData;
      if (!senderid || !participants?.length) return;

      const recipientId = participants.find((p) => p !== senderid);
      if (!recipientId) return;

      const recipientSocket = userSockets.get(recipientId);
      const isRecipientOnline = recipientSocket && onlineUsers.has(recipientId);

      if (!isRecipientOnline) {
        sendPushNotification(recipientId, messageData);
        return;
      }

      socket.to(recipientId).emit("message-received", messageData);
    } catch (error) {
      console.error("new-message error:", error);
    }
  });

  socket.on("delete-message", (messageData) => {
    if (!socket.userId) return;

    try {
      const { recipientId } = messageData;
      if (!recipientId) return;

      socket.to(recipientId).emit("message-deleted", messageData);
    } catch (error) {
      console.error("delete-message error:", error);
    }
  });

  socket.on("typing", (data) => {
    if (!socket.userId) return;

    try {
      const { recipientId, isTyping } = data;
      if (!recipientId) return;

      socket
        .to(recipientId)
        .emit("typing_status", { userId: socket.userId, isTyping });
    } catch (error) {
      console.error("typing error:", error);
    }
  });

  socket.on("messages-read", (data) => {
    if (!socket.userId) return;

    try {
      const { messageIds, chatid, senderId } = data;
      if (!messageIds?.length || !chatid || !senderId) return;

      socket.to(senderId).emit("messages-read-status", {
        messageIds,
        chatid,
        readerId: socket.userId,
      });
    } catch (error) {
      console.error("messages-read error:", error);
    }
  });
};

module.exports = {
  setupChatHandlers,
};
