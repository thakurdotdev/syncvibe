import type { Server, Socket } from 'socket.io';
import {
  musicGroups,
  getScheduledDelay,
  generateQueueItemId,
  type GroupMember,
  type QueueItem,
} from './state';
import { prunePlayedSongs, getQueueState } from './queue';

interface MusicChangeData {
  groupId: string;
  song: Record<string, unknown>;
  currentTime?: number;
  scheduledTime?: number;
  addedBy?: GroupMember;
}

interface MusicPlaybackData {
  groupId: string;
  isPlaying: boolean;
  currentTime: number;
}

interface MusicSeekData {
  groupId: string;
  isPlaying: boolean;
  currentTime: number;
}

interface SongReactionData {
  groupId: string;
  emoji: string;
  userName: string;
}

export const setupPlaybackHandlers = (io: Server, socket: Socket): void => {
  socket.on('music-change', (data: MusicChangeData) => {
    const { groupId, song, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const queueItem: QueueItem = {
      id: generateQueueItemId(),
      song,
      addedBy: addedBy || {
        userId: 'unknown',
        userName: 'Unknown',
        profilePic: '',
      },
      addedAt: Date.now(),
      status: 'playing',
    };

    group.queue.forEach((item, idx) => {
      if (idx <= group.currentQueueIndex) {
        item.status = 'played';
      }
    });

    const insertIndex = group.currentQueueIndex >= 0 ? group.currentQueueIndex + 1 : 0;
    group.queue.splice(insertIndex, 0, queueItem);
    group.currentQueueIndex = insertIndex;
    group.currentSongId = queueItem.id;

    prunePlayedSongs(group);

    const serverTime = Date.now();
    const scheduledPlayTime = serverTime + getScheduledDelay(group);

    group.playbackState = {
      ...group.playbackState,
      currentTime: 0,
      currentTrack: song,
      isPlaying: true,
      lastUpdate: scheduledPlayTime,
    };

    io.to(`music-group-${groupId}`).emit('music-update', {
      song,
      currentTime: 0,
      queueItem,
      scheduledPlayTime,
      serverTime,
    });

    io.to(`music-group-${groupId}`).emit('queue-updated', {
      ...getQueueState(group),
      action: 'play-now',
    });
  });

  socket.on('music-playback', (data: MusicPlaybackData) => {
    const group = musicGroups.get(data.groupId);
    if (!group) return;

    const serverTime = Date.now();
    group.playbackState = {
      ...group.playbackState,
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      lastUpdate: serverTime,
    };

    io.to(`music-group-${data.groupId}`).emit('playback-update', {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      serverTime,
    });
  });

  socket.on('music-seek', (data: MusicSeekData) => {
    const group = musicGroups.get(data.groupId);
    if (!group) return;

    const serverTime = Date.now();
    group.playbackState = {
      ...group.playbackState,
      currentTime: data.currentTime,
      isPlaying: data.isPlaying,
      lastUpdate: serverTime,
    };

    io.to(`music-group-${data.groupId}`).emit('playback-update', {
      isPlaying: data.isPlaying,
      currentTime: data.currentTime,
      serverTime,
      isSeeking: true,
    });
  });

  socket.on('song-reaction', (data: SongReactionData) => {
    const { groupId, emoji, userName } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    socket.to(`music-group-${groupId}`).emit('song-reaction', {
      emoji,
      userName,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    });
  });
};
