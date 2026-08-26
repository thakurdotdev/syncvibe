const { setupGroupMusicHandlers, handleUserDisconnect } = require('./groupMusic');
const { setSocketIO } = require('../utils/socketEmitter');
const { setupChatHandlers } = require('./chat');
const { setupOnlineHandlers } = require('./online');
const { createCallHandlers, handleCallDisconnect } = require('./call');

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

  io.on('connection', (socket) => {
    socket.on('setup', (userData) => {
      try {
        if (!userData?.userid) {
          socket.emit('socket-error', {
            message: 'Invalid setup data',
            code: 'SETUP_FAILED',
          });
          return;
        }

        const userId = String(userData.userid);
        socket.userId = userId;
        socket.join(userId);
        userSockets.set(userId, socket);

        if (!socket.musicHandlersSetup) {
          setupGroupMusicHandlers(io, socket, userId, userSockets);
          socket.musicHandlersSetup = true;
        }

        socket.emit('setup-complete');
      } catch (error) {
        console.error('Setup error:', error);
        socket.emit('socket-error', {
          message: 'Setup failed',
          code: 'SETUP_FAILED',
        });
      }
    });

    setupChatHandlers(io, socket, context);
    setupOnlineHandlers(io, socket, context);
    createCallHandlers(io, socket, context);

    socket.on('disconnect', () => {
      const userId = socket.userId;
      if (!userId) return;

      handleUserDisconnect(io, userId, userSockets);

      const otherUser = handleCallDisconnect(io, userId, context);
      if (otherUser) {
        io.to(String(otherUser)).emit('call-ended', {
          from: userId,
          reason: 'user_disconnected',
        });
      }

      userSockets.delete(String(userId));
      onlineUsers.delete(String(userId));

      try {
        const { getRedis } = require('../utils/redis');
        const redis = getRedis();
        if (redis) {
          redis.srem('online_users', String(userId)).catch(() => {});
        }
      } catch {}

      io.emit('user_offline', userId);
    });
  });
};

module.exports = {
  socketManager,
};
