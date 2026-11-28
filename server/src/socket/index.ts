import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket } from './types';
import { setupGroupMusicHandlers, handleUserDisconnect, releaseSocket } from './group-music';
import { setSocketIO } from '@/utils/socket-emitter';
import { userRoom } from '@/features/chat/chat.realtime';
import { markAllDelivered } from '@/features/chat/services/message.service';
import { identifySocket, sessionRoom, type SocketIdentity } from './auth';
import { setupChatHandlers } from './chat';
import { presenceActive, presenceConnected, presenceDisconnected } from './presence';
import { setupCallHandlers } from './call';
import { setupPlayerHandlers } from './player/handlers';
import { containListenerErrors } from './guard';

export const socketManager = (io: Server): void => {
  const userSockets = new Map<string, Socket>();

  setSocketIO(io, userSockets);

  // Every connection is someone signed in; there is no other way to say who you are.
  io.use((socket, next) => {
    identifySocket(socket).then(
      (identity) => {
        if (!identity) {
          next(new Error('UNAUTHENTICATED'));
          return;
        }
        socket.data.identity = identity;
        next();
      },
      (error) => {
        console.error('Socket session check failed:', error);
        // Not knowing isn't a refusal. Devices retry a connection that drops but give up on one
        // that is refused, so this one is dropped and they come back once the check works again.
        socket.conn.close();
        next(new Error('UNAVAILABLE'));
      }
    );
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    // First, so that every listener below is covered.
    containListenerErrors(socket);

    const identity: SocketIdentity = socket.data.identity;
    const userId = String(identity.userId);

    socket.userId = userId;
    userSockets.set(userId, socket);
    socket.join([userId, userRoom(identity.userId), sessionRoom(identity.sessionId)]);
    setupGroupMusicHandlers(io, socket, userId, userSockets);
    presenceConnected(identity.userId);
    // Whatever was sent while this user had no device online has now reached one.
    markAllDelivered(identity.userId).catch((error) =>
      console.error('Marking messages delivered failed:', error)
    );

    // Devices still announce themselves and wait for this answer before joining a music room.
    // Who they are comes from the session, whatever they send.
    socket.on('setup', () => socket.emit('setup-complete'));

    setupChatHandlers(socket);
    setupCallHandlers(socket);
    setupPlayerHandlers(io, socket);

    // Apps from 1.7.2 say when they go to the background, so "online" means the app is open.
    socket.on('presence:active', (payload?: { active?: unknown }) => {
      presenceActive(io, socket, identity.userId, payload?.active !== false);
    });

    socket.on('disconnect', (reason) => {
      presenceDisconnected(io, socket, identity.userId, reason);
      releaseSocket(io, userSockets, userId);
      handleUserDisconnect(io, userId);
    });
  });
};
