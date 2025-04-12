/**
 * Handles user online/offline status functionality
 */
class UserStatusHandler {
  constructor() {
    this.userSockets = new Map();
    this.onlineUsers = new Set();
  }

  /**
   * Register socket handlers for user status
   * @param {Object} socket - Socket.io socket instance
   * @param {Object} io - Socket.io server instance
   */
  registerHandlers(socket, io) {
    socket.on("user_online", (userId) => {
      this.onlineUsers.add(userId);
      io.emit("user_online", userId);
    });

    socket.on("get_initial_online_users", () => {
      socket.emit("initial_online_users", Array.from(this.onlineUsers));
    });
  }

  /**
   * Add a user's socket to tracking
   * @param {string} userId - User ID
   * @param {Object} socket - Socket.io socket instance
   */
  addUserSocket(userId, socket) {
    this.userSockets.set(userId, socket);
  }

  /**
   * Check if a user is online
   * @param {string} userId - User ID
   * @returns {boolean} - True if user has socket and is online
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.onlineUsers.has(userId);
  }

  /**
   * Get a user's socket
   * @param {string} userId - User ID
   * @returns {Object} - Socket.io socket instance
   */
  getUserSocket(userId) {
    return this.userSockets.get(userId);
  }

  /**
   * Notify when a user goes offline
   * @param {string} userId - User ID
   * @param {Object} io - Socket.io server instance
   */
  notifyUserOffline(userId, io) {
    this.userSockets.delete(userId);
    this.onlineUsers.delete(userId);
    io.emit("user_offline", userId);
  }
}

module.exports = new UserStatusHandler();
