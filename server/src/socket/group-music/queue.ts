import { generateQueueItemId, type MusicGroup, type QueueItem, type GroupMember } from './state';

export interface AddQueueResult {
  success: boolean;
  error?: string;
  queueItem?: QueueItem;
  autoPlay?: boolean;
}

export interface SkipResult {
  success: boolean;
  error?: string;
  alreadyAdvanced?: boolean;
  hasNext?: boolean;
  currentItem?: QueueItem;
}

export const addToQueue = (
  group: MusicGroup,
  song: Record<string, unknown>,
  addedBy: GroupMember
): AddQueueResult => {
  if (group.queue.length >= group.settings.maxQueueSize) {
    return { success: false, error: 'Queue is full' };
  }

  const isDuplicate = group.queue.some((item) => item.song?.id === song?.id);
  if (isDuplicate) {
    return { success: false, error: 'Song is already in the queue' };
  }

  const queueItem: QueueItem = {
    id: generateQueueItemId(),
    song,
    addedBy: {
      userId: addedBy.userId,
      userName: addedBy.userName,
      profilePic: addedBy.profilePic,
    },
    addedAt: Date.now(),
    status: 'pending',
  };

  group.queue.push(queueItem);

  const shouldAutoPlay = group.currentQueueIndex === -1;
  if (shouldAutoPlay) {
    group.currentQueueIndex = 0;
    group.currentSongId = queueItem.id;
    queueItem.status = 'playing';
    group.playbackState.currentTrack = song;
    group.playbackState.currentTime = 0;
    group.playbackState.isPlaying = true;
    group.playbackState.lastUpdate = Date.now();
  }

  return { success: true, queueItem, autoPlay: shouldAutoPlay };
};

export const addPlayNext = (
  group: MusicGroup,
  song: Record<string, unknown>,
  addedBy: GroupMember
): AddQueueResult => {
  if (group.queue.length >= group.settings.maxQueueSize) {
    return { success: false, error: 'Queue is full' };
  }

  const isDuplicate = group.queue.some((item) => item.song?.id === song?.id);
  if (isDuplicate) {
    return { success: false, error: 'Song is already in the queue' };
  }

  const queueItem: QueueItem = {
    id: generateQueueItemId(),
    song,
    addedBy: {
      userId: addedBy.userId,
      userName: addedBy.userName,
      profilePic: addedBy.profilePic,
    },
    addedAt: Date.now(),
    status: 'pending',
  };

  if (group.currentQueueIndex === -1) {
    group.queue.push(queueItem);
    group.currentQueueIndex = 0;
    group.currentSongId = queueItem.id;
    queueItem.status = 'playing';
    group.playbackState.currentTrack = song;
    group.playbackState.currentTime = 0;
    group.playbackState.isPlaying = true;
    group.playbackState.lastUpdate = Date.now();
    return { success: true, queueItem, autoPlay: true };
  }

  const insertIndex = group.currentQueueIndex + 1;
  group.queue.splice(insertIndex, 0, queueItem);
  return { success: true, queueItem, autoPlay: false };
};

export const removeFromQueue = (
  group: MusicGroup,
  queueItemId: string,
  userId: string | number
): { success: boolean; error?: string } => {
  const index = group.queue.findIndex((item) => item.id === queueItemId);
  if (index === -1) {
    return { success: false, error: 'Item not found' };
  }

  const item = group.queue[index]!;

  if (
    String(item.addedBy.userId) !== String(userId) &&
    String(group.createdBy) !== String(userId)
  ) {
    return { success: false, error: 'Not authorized' };
  }

  if (index === group.currentQueueIndex) {
    return {
      success: false,
      error: 'Cannot remove currently playing song. Use skip instead.',
    };
  }

  group.queue.splice(index, 1);

  if (index < group.currentQueueIndex) {
    group.currentQueueIndex--;
  }

  return { success: true };
};

export const skipToNext = (group: MusicGroup, expectedSongId: string | null = null): SkipResult => {
  if (group.queue.length === 0) {
    return { success: false, error: 'Queue is empty' };
  }

  if (expectedSongId && group.currentSongId !== expectedSongId) {
    return {
      success: false,
      error: 'Song already advanced',
      alreadyAdvanced: true,
    };
  }

  if (group.currentQueueIndex === -1) {
    if (group.queue.length > 0) {
      group.currentQueueIndex = 0;
      group.currentSongId = group.queue[0]!.id;
      group.queue[0]!.status = 'playing';
      group.playbackState.currentTrack = group.queue[0]!.song;
      group.playbackState.currentTime = 0;
      group.playbackState.isPlaying = true;
      group.playbackState.lastUpdate = Date.now();
      return { success: true, hasNext: true, currentItem: group.queue[0] };
    }
    return { success: false, error: 'Queue is empty' };
  }

  if (group.currentQueueIndex >= 0 && group.currentQueueIndex < group.queue.length) {
    const currentItem = group.queue[group.currentQueueIndex]!;
    if (currentItem.status === 'playing') {
      currentItem.status = 'played';
    }
  }

  const nextIndex = group.currentQueueIndex + 1;

  if (nextIndex >= group.queue.length) {
    group.currentQueueIndex = -1;
    group.currentSongId = null;
    group.playbackState.currentTrack = null;
    group.playbackState.isPlaying = false;
    group.playbackState.currentTime = 0;
    return { success: true, hasNext: false };
  }

  const nextItem = group.queue[nextIndex]!;
  group.currentQueueIndex = nextIndex;
  group.currentSongId = nextItem.id;
  nextItem.status = 'playing';
  group.playbackState.currentTrack = nextItem.song;
  group.playbackState.currentTime = 0;
  group.playbackState.isPlaying = true;
  group.playbackState.lastUpdate = Date.now();

  return {
    success: true,
    hasNext: true,
    currentItem: nextItem,
  };
};

export const prunePlayedSongs = (group: MusicGroup): void => {
  const playedCount = group.queue.filter((item) => item.status === 'played').length;
  if (playedCount === 0) return;
  group.queue = group.queue.filter((item) => item.status !== 'played');
  if (group.currentQueueIndex >= 0) {
    group.currentQueueIndex = Math.max(0, group.currentQueueIndex - playedCount);
  }
};

export const reorderQueue = (
  group: MusicGroup,
  fromIndex: number,
  toIndex: number
): { success: boolean; error?: string } => {
  if (fromIndex <= group.currentQueueIndex || toIndex <= group.currentQueueIndex) {
    return {
      success: false,
      error: 'Cannot reorder played or currently playing songs',
    };
  }

  if (
    fromIndex < 0 ||
    fromIndex >= group.queue.length ||
    toIndex < 0 ||
    toIndex >= group.queue.length
  ) {
    return { success: false, error: 'Invalid index' };
  }

  const [item] = group.queue.splice(fromIndex, 1);
  if (item) {
    group.queue.splice(toIndex, 0, item);
  }

  return { success: true };
};

export const clearPendingQueue = (
  group: MusicGroup,
  userId: string | number
): { success: boolean; clearedCount: number; error?: string } => {
  const isMember = group.members.some((m) => String(m.userId) === String(userId));
  if (!isMember && String(group.createdBy) !== String(userId)) {
    return { success: false, clearedCount: 0, error: 'Not authorized' };
  }

  const keepIndex = group.currentQueueIndex;
  const initialLength = group.queue.length;

  if (keepIndex >= 0) {
    group.queue = group.queue.slice(0, keepIndex + 1);
  } else {
    group.queue = [];
  }

  const clearedCount = initialLength - group.queue.length;
  return { success: true, clearedCount };
};

export const addRecommendedSongsToQueue = (
  group: MusicGroup,
  songs: Array<Record<string, unknown>>
): { addedCount: number; autoPlay: boolean; firstItem?: QueueItem } => {
  let addedCount = 0;
  let firstItem: QueueItem | undefined;
  let shouldAutoPlay = false;

  for (const song of songs) {
    if (group.queue.length >= group.settings.maxQueueSize) break;
    const isDuplicate = group.queue.some((item) => item.song?.id === song?.id);
    if (isDuplicate) continue;

    const queueItem: QueueItem = {
      id: generateQueueItemId(),
      song,
      addedBy: {
        userId: 'system',
        userName: 'Auto-Play',
        profilePic: '',
      },
      addedAt: Date.now(),
      status: 'pending',
      isAutoRecommended: true,
    };

    group.queue.push(queueItem);
    if (addedCount === 0) {
      firstItem = queueItem;
      if (group.currentQueueIndex === -1) {
        shouldAutoPlay = true;
        group.currentQueueIndex = 0;
        group.currentSongId = queueItem.id;
        queueItem.status = 'playing';
        group.playbackState.currentTrack = song;
        group.playbackState.currentTime = 0;
        group.playbackState.isPlaying = true;
        group.playbackState.lastUpdate = Date.now();
      }
    }
    addedCount++;
  }

  return { addedCount, autoPlay: shouldAutoPlay, firstItem };
};

export const getQueueState = (group: MusicGroup) => ({
  queue: group.queue,
  currentQueueIndex: group.currentQueueIndex,
  currentSongId: group.currentSongId,
  currentItem: group.currentQueueIndex >= 0 ? (group.queue[group.currentQueueIndex] ?? null) : null,
});
