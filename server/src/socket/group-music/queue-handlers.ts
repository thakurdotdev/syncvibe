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
  clearPendingQueue,
  addRecommendedSongsToQueue,
} from './queue';
import { Song, GroupSessionHistory } from '@/models/index';
import { getPlayNextSongs } from '@/features/music/services/play-next.service';

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

interface ClearQueueData {
  groupId: string;
  userId: string | number;
}

interface ToggleAutoRecommendationsData {
  groupId: string;
  enabled?: boolean;
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

export const ensureGroupHasRecommendations = async (
  io: Server,
  groupId: string,
  seedSongId?: string
): Promise<boolean> => {
  const group = musicGroups.get(groupId);
  if (!group || group.settings.autoPlayRecommendations === false || group.isFetchingRecommendations) {
    return false;
  }

  const upcomingCount = group.queue.length - (group.currentQueueIndex + 1);
  if (upcomingCount > 1) {
    return false;
  }

  const baseSongId =
    seedSongId ||
    (group.currentQueueIndex >= 0 ? (group.queue[group.currentQueueIndex]?.song?.id as string) : null) ||
    (group.queue.length > 0 ? (group.queue[group.queue.length - 1]?.song?.id as string) : null);

  if (!baseSongId) return false;

  group.isFetchingRecommendations = true;
  try {
    const existingSongIds = group.queue.map((q) => String(q.song?.id)).filter(Boolean);
    const recs = await getPlayNextSongs({
      baseSongId: String(baseSongId),
      limit: 5,
      excludeSongIds: existingSongIds,
    });

    if (recs && recs.length > 0) {
      const { addedCount, autoPlay, firstItem } = addRecommendedSongsToQueue(group, recs);
      if (addedCount > 0) {
        io.to(`music-group-${groupId}`).emit('queue-updated', {
          ...getQueueState(group),
          action: 'auto-recs',
          addedCount,
        });

        if (autoPlay && firstItem) {
          const serverTime = Date.now();
          const scheduledPlayTime = serverTime + getScheduledDelay(group);
          io.to(`music-group-${groupId}`).emit('music-update', {
            song: firstItem.song,
            currentTime: 0,
            queueItem: firstItem,
            scheduledPlayTime,
            serverTime,
          });
          group.playbackState.isPlaying = true;
          group.playbackState.currentTime = 0;
          group.playbackState.lastUpdate = scheduledPlayTime;

          emitActivityMessage(io, groupId, 'song-playing', {
            songName: (firstItem.song.name as string) || 'Song',
            addedBy: 'Auto-Play',
          });
        }
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error(`[GroupMusic] Auto-recommendation error for group ${groupId}:`, err);
    return false;
  } finally {
    group.isFetchingRecommendations = false;
  }
};

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

  socket.on('skip-song', async (data: SkipSongData) => {
    const { groupId, userName } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const completedItem =
      group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null;

    let result = skipToNext(group);

    if (result.success) {
      if (completedItem) persistSongHistory(group, completedItem);
      prunePlayedSongs(group);

      if (!result.hasNext) {
        const added = await ensureGroupHasRecommendations(
          io,
          groupId,
          completedItem?.song?.id as string
        );
        if (added) {
          result = skipToNext(group);
        }
      }

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

        ensureGroupHasRecommendations(io, groupId);
      } else {
        io.to(`music-group-${groupId}`).emit('queue-ended');
        emitActivityMessage(io, groupId, 'queue-ended', {});
      }
    }
  });

  socket.on('song-ended', async (data: SongEndedData) => {
    const { groupId, songId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const completedItem =
      group.currentQueueIndex >= 0 ? group.queue[group.currentQueueIndex] : null;

    let result = skipToNext(group, songId || null);

    if (result.alreadyAdvanced) {
      console.log(`Ignoring duplicate song-ended for song ${songId}`);
      return;
    }

    if (!result.success) return;

    if (completedItem) persistSongHistory(group, completedItem);
    prunePlayedSongs(group);

    if (!result.hasNext) {
      const added = await ensureGroupHasRecommendations(
        io,
        groupId,
        completedItem?.song?.id as string
      );
      if (added) {
        result = skipToNext(group);
      }
    }

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

      ensureGroupHasRecommendations(io, groupId);
    } else {
      io.to(`music-group-${groupId}`).emit('queue-ended');
      emitActivityMessage(io, groupId, 'queue-ended', {});
    }
  });

  socket.on('clear-queue', (data: ClearQueueData) => {
    const { groupId, userId } = data;
    const group = musicGroups.get(groupId);
    if (!group) return;

    const result = clearPendingQueue(group, userId);

    if (result.success) {
      io.to(`music-group-${groupId}`).emit('queue-updated', {
        ...getQueueState(group),
        action: 'clear',
        clearedCount: result.clearedCount,
      });

      // If autoplay recommendations is enabled, top up recommendations
      if (group.settings.autoPlayRecommendations) {
        ensureGroupHasRecommendations(io, groupId);
      }
    } else {
      socket.emit('queue-error', { error: result.error });
    }
  });

  socket.on(
    'toggle-auto-recommendations',
    (data: ToggleAutoRecommendationsData) => {
      const { groupId, enabled } = data;
      const group = musicGroups.get(groupId);
      if (!group) return;

      group.settings.autoPlayRecommendations =
        typeof enabled === 'boolean' ? enabled : !group.settings.autoPlayRecommendations;

      io.to(`music-group-${groupId}`).emit('group-settings-updated', {
        settings: group.settings,
      });

      if (group.settings.autoPlayRecommendations) {
        ensureGroupHasRecommendations(io, groupId);
      }
    }
  );

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
