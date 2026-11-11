import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket } from './types';
import { setupGroupMusicHandlers, handleUserDisconnect, releaseSocket } from './group-music';
import { setSocketIO } from '@/utils/socket-emitter';
import { userRoom } from '@/features/chat/chat.realtime';
import { markAllDelivered } from '@/features/chat/services/message.service';
import { identifySocket, sessionRoom } from './auth';
import { setupChatHandlers } from './chat';
import { presenceActive, presenceConnected, presenceDisconnected } from './presence';
import { setupCallHandlers } from './call';
import { setupPlayerHandlers } from './player/handlers';

/** Set once no app older than 1.7 is in use: sockets without a valid session are then refused. */
const REQUIRE_SESSION = process.env.SOCKET_REQUIRE_SESSION === 'true';

export const socketManager = (io: Server): void => {
  const userSockets = new Map<string, Socket>();

  setSocketIO(io, userSockets);

  io.use((socket, next) => {
    identifySocket(socket)
      .catch((error) => {
        console.error('Socket session check failed:', error);
        return null;
      })
      .then((identity) => {
        if (!identity && REQUIRE_SESSION) {
          next(new Error('UNAUTHENTICATED'));
          return;
        }
        socket.data.identity = identity ?? undefined;
        next();
      });
  });

  /** Makes the socket this user's: their rooms, and the music handlers that act as them. */
  const adopt = (socket: AuthenticatedSocket, userId: string) => {
    socket.userId = userId;
    socket.join(userId);
    userSockets.set(userId, socket);

    if (!socket.musicHandlersSetup) {
      setupGroupMusicHandlers(io, socket, userId, userSockets);
      socket.musicHandlersSetup = true;
    }
  };

  io.on('connection', (socket: AuthenticatedSocket) => {
    const identity = socket.data.identity;

    if (identity) {
      adopt(socket, String(identity.userId));
      socket.join([userRoom(identity.userId), sessionRoom(identity.sessionId)]);
      presenceConnected(identity.userId);
      // Whatever was sent while this user had no device online has now reached one.
      markAllDelivered(identity.userId).catch((error) =>
        console.error('Marking messages delivered failed:', error)
      );
    }

    socket.on('setup', (userData?: { userid?: string | number }) => {
      try {
        // A signed-in socket already is who its session says, whatever it sends here.
        if (identity) {
          socket.emit('setup-complete');
          return;
        }

        if (!userData?.userid) {
          socket.emit('socket-error', {
            message: 'Invalid setup data',
            code: 'SETUP_FAILED',
          });
          return;
        }

        // Apps up to 1.6.x connect without a session and name their user here. That is enough for
        // music rooms as it always was, and for nothing else.
        adopt(socket, String(userData.userid));
        socket.emit('setup-complete');
      } catch (error) {
        console.error('Setup error:', error);
        socket.emit('socket-error', {
          message: 'Setup failed',
          code: 'SETUP_FAILED',
        });
      }
    });

    setupChatHandlers(socket);
    setupCallHandlers(socket);
    setupPlayerHandlers(io, socket);

    // Apps from 1.7.2 say when they go to the background, so "online" means the app is open.
    socket.on('presence:active', (payload?: { active?: unknown }) => {
      if (identity) presenceActive(io, socket, identity.userId, payload?.active !== false);
    });

    socket.on('disconnect', (reason) => {
      if (identity) presenceDisconnected(io, socket, identity.userId, reason);

      const userId = socket.userId;
      if (!userId) return;

      releaseSocket(io, userSockets, userId, socket);
      handleUserDisconnect(io, userId);
    });
  });
};
