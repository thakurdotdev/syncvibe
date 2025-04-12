const { sendPushNotification } = require("./notificationHandler");
const userStatusHandler = require("./userStatusHandler");

/**
 * Handles chat functionality
 */
class ChatHandler {
  /**
   * Register socket handlers for chat functionality
   * @param {Object} socket - Socket.io socket instance
   * @param {Object} io - Socket.io server instance
   */
  registerHandlers(socket, io) {
    // Chat room management
    socket.on("join-chat", (room) => {
      try {
        socket.join(room);
      } catch (error) {
        this.handleError(socket, error, "JOIN_CHAT_FAILED");
      }
    });

    // Message handling
    socket.on("new-message", (messageData) => {
      try {
        const { senderid, participants } = messageData;
        const recipientId = participants.find(
          (participant) => participant !== senderid,
        );

        const isRecipientOnline = userStatusHandler.isUserOnline(recipientId);

        if (!isRecipientOnline) {
          sendPushNotification(recipientId, messageData);
          return;
        }
        socket.to(recipientId).emit("message-received", messageData);
      } catch (error) {
        this.handleError(socket, error, "MESSAGE_FAILED");
      }
    });

    socket.on("delete-message", (messageData) => {
      try {
        const { recipientId } = messageData;
        socket.to(recipientId).emit("message-deleted", messageData);
      } catch (error) {
        this.handleError(socket, error, "DELETE_MESSAGE_FAILED");
      }
    });

    // Typing status
    socket.on("typing", (data) => {
      try {
        const { userId, recipientId, isTyping } = data;
        socket.to(recipientId).emit("typing_status", { userId, isTyping });
      } catch (error) {
        this.handleError(socket, error, "TYPING_STATUS_FAILED");
      }
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
        this.handleError(socket, error, "MESSAGE_READ_STATUS_FAILED");
      }
    });
  }

  /**
   * Handle chat-related errors
   * @param {Object} socket - Socket.io socket instance
   * @param {Error} error - Error object
   * @param {string} code - Error code
   */
  handleError(socket, error, code) {
    console.error(`Chat error (${code}):`, error);
    socket.emit("chat-error", {
      message: error.message || "An error occurred",
      code,
    });
  }
}

module.exports = new ChatHandler();
