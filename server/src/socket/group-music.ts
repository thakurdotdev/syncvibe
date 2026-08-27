import type { Server, Socket } from 'socket.io';
import type { AuthenticatedSocket } from './types';
import {
  musicGroups,
  getGroup,
  TIME_TO_REJOIN,
  getUserGroups,
  userGroups,
} from './group-music/state';
import { getQueueState } from './group-music/queue';
import { setupQueueHandlers } from './group-music/queue-handlers';
import { setupPlaybackHandlers } from './group-music/playback-handlers';
import { setupInviteHandlers } from './group-music/invite-handlers';

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
    if (!group) return;

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
    });
  });

  setupQueueHandlers(io, socket);
  setupPlaybackHandlers(io, socket);
  setupInviteHandlers(io, socket, userId);
};

export const handleUserDisconnect = (
  io: Server,
  userId: string | number,
  userSockets: Map<string, Socket>
): void => {
  const userGroupSet = getUserGroups(userId);

  if (userGroupSet.size > 0) {
    setTimeout(() => {
      const reconnected = userSockets.has(String(userId));

      if (!reconnected) {
        userGroupSet.forEach((groupId) => {
          const group = musicGroups.get(groupId);

          if (group) {
            group.members = group.members.filter((m) => String(m.userId) !== String(userId));
            io.to(`music-group-${groupId}`).emit('member-left', { userId });

            if (group.members.length === 0) {
              musicGroups.delete(groupId);
            }
          }
        });

        userGroups.delete(String(userId));
      }
    }, TIME_TO_REJOIN);
  }
};

export { getGroup, musicGroups };
