import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket } from './types';
import { musicGroups, getGroup } from './group-music/state';
import './group-music/effects.live';
import { setupCommandHandlers } from './group-music/commands';
import { setupLegacyHandlers } from './group-music/legacy-handlers';
import { setupInviteHandlers } from './group-music/invite-handlers';
import { setupChatHandlers } from './group-music/chat-handlers';

export const setupGroupMusicHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  userId: string | number,
  _userSockets: Map<string, Socket>
): void => {
  setupCommandHandlers(io, socket, userId);
  setupLegacyHandlers(io, socket, userId);
  setupInviteHandlers(io, socket, userId);
  setupChatHandlers(io, socket, userId);
};

export { handleUserDisconnect, releaseSocket } from './group-music/presence';
export { restoreRooms } from './group-music/restore';
export { flushRooms } from './group-music/room-store';
export { getGroup, musicGroups };
