import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket, SocketContext } from './types';
import { setupGroupMusicHandlers, handleUserDisconnect } from './group-music';
import { setSocketIO } from '@/utils/socket-emitter';
import { setupChatHandlers } from './chat';
import { setupOnlineHandlers } from './online';
import { createCallHandlers, handleCallDisconnect } from './call';
import { getRedis } from '@/utils/redis';

export const socketManager = (io: Server): void => {
  const userSockets = new Map<string, Socket>();
  const onlineUsers = new Set<string>();
  const activeVideoCalls = new Map<string, string | number>();
  const callTimeouts = new Map<string, NodeJS.Timeout>();
  const callStartTimes = new Map<string, number>();

  setSocketIO(io, userSockets);

  const context: SocketContext = {
    userSockets,
    onlineUsers,
    activeVideoCalls,
    callTimeouts,
    callStartTimes,
  };

  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.on('setup', (userData?: { userid?: string | number }) => {
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
        const redis = getRedis();
        if (redis) {
          redis.srem('online_users', String(userId)).catch(() => {});
        }
      } catch {}

      io.emit('user_offline', userId);
    });
  });
};
