const userStatusHandler = require("./userStatusHandler");
const { sendPushNotification } = require("./notificationHandler");

/**
 * Handles video call signaling functionality
 */
class CallHandler {
  constructor() {
    this.activeVideoCalls = new Map();
    this.callTimeouts = new Map();
    this.CALL_TIMEOUT = 30000; // 30 seconds timeout
  }

  /**
   * Register socket handlers for call functionality
   * @param {Object} socket - Socket.io socket instance
   * @param {Object} io - Socket.io server instance
   * @param {string} userId - Current user ID
   */
  registerHandlers(socket, io, userId) {
    socket.on("call-user", async (data) => {
      try {
        const { to, from, name, profilepic, offer } = data;

        // Validate call possibility
        const recipientSocket = userStatusHandler.getUserSocket(to);
        if (!recipientSocket) {
          // Send push notification instead of just throwing error
          await sendPushNotification(to, {
            senderName: name || "Someone",
            content: "is calling you",
            chatid: from, // Using from as identifier
            type: "call",
          });

          throw new Error("User is offline");
        }

        if (this.activeVideoCalls.has(to)) {
          throw new Error("User is busy");
        }

        // Setup call tracking
        this.activeVideoCalls.set(from, to);
        this.activeVideoCalls.set(to, from);

        // Set timeout for unanswered calls
        const timeoutId = setTimeout(() => {
          if (this.activeVideoCalls.has(from)) {
            this.cleanupCall(from);
            socket.emit("call-error", {
              message: "Call not answered",
              code: "CALL_TIMEOUT",
            });
            socket.to(to).emit("call-ended", {
              from,
              reason: "timeout",
            });
          }
        }, this.CALL_TIMEOUT);

        this.callTimeouts.set(from, timeoutId);

        // Notify recipient
        socket.to(to).emit("incoming-call", {
          from,
          name,
          profilepic,
          offer,
        });
      } catch (error) {
        this.handleCallError(socket, error, "CALL_INITIATION_FAILED");
      }
    });

    socket.on("call-accepted", (data) => {
      try {
        const { to, name, profilepic, answer } = data;

        // Clear call timeout since call was answered
        if (this.callTimeouts.has(to)) {
          clearTimeout(this.callTimeouts.get(to));
          this.callTimeouts.delete(to);
        }

        socket.to(to).emit("call-accepted", {
          from: userId,
          name,
          profilepic,
          answer,
        });
      } catch (error) {
        this.handleCallError(socket, error, "CALL_ACCEPT_FAILED");
      }
    });

    socket.on("call-rejected", (data) => {
      try {
        const { to, reason } = data;
        const otherUser = this.cleanupCall(userId);

        if (otherUser) {
          socket.to(to).emit("call-rejected", {
            from: userId,
            reason,
          });
        }
      } catch (error) {
        this.handleCallError(socket, error, "CALL_REJECT_FAILED");
      }
    });

    socket.on("ice-candidate", (data) => {
      try {
        const { to, candidate } = data;

        // Only forward ICE candidates if call is still active
        if (
          this.activeVideoCalls.has(userId) &&
          this.activeVideoCalls.get(userId) === to
        ) {
          socket.to(to).emit("ice-candidate", {
            from: userId,
            candidate,
          });
        }
      } catch (error) {
        this.handleCallError(socket, error, "ICE_CANDIDATE_FAILED");
      }
    });

    socket.on("end-call", (data) => {
      try {
        const { to } = data;
        const otherUser = this.cleanupCall(userId);

        if (otherUser) {
          socket.to(to).emit("call-ended", {
            from: userId,
          });
        }
      } catch (error) {
        this.handleCallError(socket, error, "END_CALL_FAILED");
      }
    });
  }

  /**
   * Cleanup active call for a user
   * @param {string} userId - User ID
   * @returns {string|null} - The other user ID if call was active
   */
  cleanupCall(userId) {
    if (this.activeVideoCalls.has(userId)) {
      const otherUser = this.activeVideoCalls.get(userId);
      this.activeVideoCalls.delete(userId);
      this.activeVideoCalls.delete(otherUser);

      // Clear any pending call timeouts
      if (this.callTimeouts.has(userId)) {
        clearTimeout(this.callTimeouts.get(userId));
        this.callTimeouts.delete(userId);
      }
      if (this.callTimeouts.has(otherUser)) {
        clearTimeout(this.callTimeouts.get(otherUser));
        this.callTimeouts.delete(otherUser);
      }

      return otherUser;
    }
    return null;
  }

  /**
   * Handle call-related errors
   * @param {Object} socket - Socket.io socket instance
   * @param {Error} error - Error object
   * @param {string} code - Error code
   */
  handleCallError(socket, error, code) {
    console.error(`Call error (${code}):`, error);
    socket.emit("call-error", {
      message: error.message || "An error occurred during the call",
      code,
    });
  }
}

module.exports = new CallHandler();
