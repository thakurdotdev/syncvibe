import type { Server, Socket } from 'socket.io';
import {
  musicGroups,
  emitActivityMessage,
  getScheduledDelay,
  type GroupMember,
  type MusicGroup,
  type QueueItem,
} from './state';
import {
  addToQueue,
  addPlayNext,
  removeFromQueue,
  skipToNext,
  prunePlayedSongs,
  reorderQueue,
  getQueueState,
} from './queue';
import { Song, GroupSessionHistory } from '@/models/index';

interface QueueActionData {
  groupId: string;
  song: Record<string, unknown>;
  addedBy: GroupMember;
}

interface PlaylistQueueData {
  groupId: string;
  songs: Array<Record<string, unknown>>;
  addedBy: GroupMember;
}

interface RemoveQueueData {
  groupId: string;
  queueItemId: string;
  userId: string | number;
}

interface SkipSongData {
  groupId: string;
  userName?: string;
}

interface SongEndedData {
  groupId: string;
  songId?: string;
}

interface ReorderQueueData {
  groupId: string;
  fromIndex: number;
  toIndex: number;
}

const persistSongHistory = async (group: MusicGroup, queueItem: QueueItem): Promise<void> => {
  if (!queueItem?.song?.id) return;
  try {
    const songRecord = await Song.getOrCreate(queueItem.song);
    if (!songRecord) return;
    await GroupSessionHistory.create({
      sessionId: group.id,
      groupId: group.id,
      songRefId: songRecord.id,
      addedByUserId: queueItem.addedBy?.userId
        ? parseInt(String(queueItem.addedBy.userId), 10) || null
        : null,
      playedAt: new Date(),
    });
  } catch (err) {
    console.error('[GroupHistory] Failed to persist:', (err as Error).message);
  }
};

export const setupQueueHandlers = (io: Server, socket: Socket): void => {
  socket.on('add-to-queue', (data: QueueActionData) => {
    const { groupId, song, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = addToQueue(group, song, addedBy);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'add',
        item: result.queueItem,
      });

      emitActivityMessage(io, groupId, 'song-added', {
        userName: addedBy.userName,
        songName: (song.name as string) || 'Song',
      });

      if (result.autoPlay && group.queue.length === 1 && result.queueItem) {
        const serverTime = Date.now();
        const scheduledPlayTime = serverTime + getScheduledDelay(group);
        io.to(`music-group-${groupId}`).emit('music-update', {
          song: result.queueItem.song,
          currentTime: 0,
          queueItem: result.queueItem,
          scheduledPlayTime,
          serverTime,
        });

        group.playbackState.isPlaying = true;
        group.playbackState.currentTime = 0;
        group.playbackState.lastUpdate = scheduledPlayTime;

        emitActivityMessage(io, groupId, 'song-playing', {
          songName: (song.name as string) || 'Song',
          addedBy: addedBy.userName,
        });
      }
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  socket.on('play-next', (data: QueueActionData) => {
    const { groupId, song, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = addPlayNext(group, song, addedBy);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'play-next',
        item: result.queueItem,
      });

      emitActivityMessage(io, groupId, 'song-added', {
        userName: addedBy.userName,
        songName: (song.name as string) || 'Song',
      });

      if (result.autoPlay && result.queueItem) {
        const serverTime = Date.now();
        const scheduledPlayTime = serverTime + getScheduledDelay(group);
        io.to(`music-group-${groupId}`).emit('music-update', {
          song: result.queueItem.song,
          currentTime: 0,
          queueItem: result.queueItem,
          scheduledPlayTime,
          serverTime,
        });

        group.playbackState.isPlaying = true;
        group.playbackState.currentTime = 0;
        group.playbackState.lastUpdate = scheduledPlayTime;

        emitActivityMessage(io, groupId, 'song-playing', {
          songName: (song.name as string) || 'Song',
          addedBy: addedBy.userName,
        });
      }
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  socket.on('add-playlist-to-queue', (data: PlaylistQueueData) => {
    const { groupId, songs, addedBy } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    let addedCount = 0;
    const errors: string[] = [];

    for (const song of songs) {
      const result = addToQueue(group, song, addedBy);
      if (result.success) {
        addedCount++;
        if (result.autoPlay && addedCount === 1 && result.queueItem) {
          const serverTime = Date.now();
          const scheduledPlayTime = serverTime + getScheduledDelay(group);
          io.to(`music-group-${groupId}`).emit('music-update', {
            song: result.queueItem.song,
            currentTime: 0,
            queueItem: result.queueItem,
            scheduledPlayTime,
            serverTime,
          });
          group.playbackState.isPlaying = true;
          group.playbackState.currentTime = 0;
          group.playbackState.lastUpdate = scheduledPlayTime;

          emitActivityMessage(io, groupId, 'song-playing', {
            songName: (song.name as string) || 'Song',
            addedBy: addedBy.userName,
          });
        }
      } else {
        if (result.error === 'Queue is full') break;
        if (result.error) errors.push(result.error);
      }
    }

    if (addedCount > 0) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'playlist-added',
        addedCount,
      });
    }

    if (addedCount === 0 && errors.length > 0) {
      socket.emit('queue-error', { error: errors[0] });
    }
  });

  socket.on('remove-from-queue', (data: RemoveQueueData) => {
    const { groupId, queueItemId, userId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = removeFromQueue(group, queueItemId, userId);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'remove',
        removedId: queueItemId,
      });
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  socket.on('skip-song', (data: SkipSongData) => {
    const { groupId, userName } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const completedItem =
      group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null;

    const result = skipToNext(group);

    if (result.success) {
      if (completedItem) persistSongHistory(group, completedItem);
      prunePlayedSongs(group);

      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'skip',
      });

      emitActivityMessage(io, groupId, 'song-skipped', { userName });

      if (result.hasNext && result.currentItem) {
        const serverTime = Date.now();
        const scheduledPlayTime = serverTime + getScheduledDelay(group);
        io.to(`music-group-${groupId}`).emit('music-update', {
          song: result.currentItem.song,
          currentTime: 0,
          queueItem: result.currentItem,
          scheduledPlayTime,
          serverTime,
        });

        group.playbackState.currentTime = 0;
        group.playbackState.lastUpdate = scheduledPlayTime;

        emitActivityMessage(io, groupId, 'song-playing', {
          songName: (result.currentItem.song.name as string) || 'Song',
          addedBy: result.currentItem.addedBy?.userName,
        });
      } else {
        io.to(`music-group-${groupId}`).emit('queue-ended');
        emitActivityMessage(io, groupId, 'queue-ended', {});
      }
    }
  });

  socket.on('song-ended', (data: SongEndedData) => {
    const { groupId, songId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const completedItem =
      group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null;

    const result = skipToNext(group, songId || null);

    if (result.alreadyAdvanced) {
      console.log(`Ignoring duplicate song-ended for song ${songId}`);
      return;
    }

    if (!result.success) return;

    if (completedItem) persistSongHistory(group, completedItem);
    prunePlayedSongs(group);

    io.to(`music-group-${groupId}`).emit('queue-updated', {
      ...getQueueState(group),
      action: 'song-ended',
    });

    if (result.hasNext && result.currentItem) {
      const serverTime = Date.now();
      const scheduledPlayTime = serverTime + getScheduledDelay(group);
      io.to(`music-group-${groupId}`).emit('music-update', {
        song: result.currentItem.song,
        currentTime: 0,
        queueItem: result.currentItem,
        autoPlay: true,
        scheduledPlayTime,
        serverTime,
      });

      group.playbackState.currentTime = 0;
      group.playbackState.lastUpdate = scheduledPlayTime;

      emitActivityMessage(io, groupId, 'song-playing', {
        songName: (result.currentItem.song.name as string) || 'Song',
        addedBy: result.currentItem.addedBy?.userName,
      });
    } else {
      io.to(`music-group-${groupId}`).emit('queue-ended');
      emitActivityMessage(io, groupId, 'queue-ended', {});
    }
  });

  socket.on('reorder-queue', (data: ReorderQueueData) => {
    const { groupId, fromIndex, toIndex } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = reorderQueue(group, fromIndex, toIndex);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'reorder',
      });
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });
};
