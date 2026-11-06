import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket } from './types';
import { musicGroups, getGroup, getUserGroups } from './group-music/state';
import { getQueueState } from './group-music/queue';
import { setupQueueHandlers } from './group-music/queue-handlers';
import { setupPlaybackHandlers } from './group-music/playback-handlers';
import { setupInviteHandlers } from './group-music/invite-handlers';
import { setupChatHandlers } from './group-music/chat-handlers';

export const setupGroupMusicHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  userId: string | number,
  _userSockets: Map<string, Socket>
): void => {
  socket.on('time-sync-request', (data: { clientTime: number }) => {
    const rtt = Date.now() - data.clientTime;
    const userGroupSet = getUserGroups(userId);
    userGroupSet.forEach((groupId) => {
      const group = musicGroups.get(groupId);
      if (group) group.memberRTT.set(userId, rtt);
    });

    socket.emit('time-sync-response', {
      clientTime: data.clientTime,
      serverTime: Date.now(),
    });
  });

  socket.on('get-music-groups', () => {
    socket.emit('music-groups', Array.from(musicGroups.values()));
  });

  socket.on('request-sync', (data: { groupId: string }) => {
    const group = musicGroups.get(data.groupId);
    // These checks run every few seconds, so they also catch a device that has lost its place:
    // the room has ended, or this connection never got back into it after a reconnect.
    if (!group) {
      socket.emit('sync-lost', { groupId: data.groupId, reason: 'group-gone' });
      return;
    }
    if (!socket.rooms.has(`music-group-${data.groupId}`)) {
      socket.emit('sync-lost', { groupId: data.groupId, reason: 'not-in-room' });
      return;
    }

    const currentItem = group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null;
    const serverTime = Date.now();

    socket.emit('sync-state', {
      playbackState: {
        ...group.playbackState,
        serverTime,
        currentTrack: currentItem?.song || null,
      },
      ...getQueueState(group),
      currentSongId: group.currentSongId,
      settings: group.settings,
    });
  });

  setupQueueHandlers(io, socket);
  setupPlaybackHandlers(io, socket);
  setupInviteHandlers(io, socket, userId);
  setupChatHandlers(io, socket, userId);
};

export { handleUserDisconnect, releaseSocket } from './group-music/presence';
export { getGroup, musicGroups };
