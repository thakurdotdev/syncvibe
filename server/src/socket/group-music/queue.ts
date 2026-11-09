import {
  generateQueueItemId,
  isHost,
  type GroupMember,
  type MusicGroup,
  type QueueItem,
} from './state';

/*
 * The queue is the song that's on plus what comes after it. These only change the room's record;
 * telling devices about it, and anything to do with time, is the engine's job.
 */

export type QueueError = 'queue-full' | 'duplicate' | 'not-found' | 'forbidden' | 'invalid';

export const QUEUE_ERROR_TEXT: Record<QueueError, string> = {
  'queue-full': 'Queue is full',
  duplicate: 'Song is already in the queue',
  'not-found': 'Item not found',
  forbidden: 'Not authorized',
  invalid: 'Invalid request',
};

export const AUTOPLAY_MEMBER: GroupMember = {
  userId: 'system',
  userName: 'Auto-Play',
  profilePic: '',
};

export const songIdOf = (song: unknown): string => {
  const id = (song as { id?: unknown } | null)?.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : '';
};

export const queueSize = (group: MusicGroup): number =>
  group.upcoming.length + (group.current ? 1 : 0);

export const hasSong = (group: MusicGroup, songId: string): boolean =>
  (group.current ? songIdOf(group.current.song) === songId : false) ||
  group.upcoming.some((item) => songIdOf(item.song) === songId);

export const createQueueItem = (
  song: Record<string, unknown>,
  addedBy: GroupMember,
  isAutoRecommended = false
): QueueItem => ({
  id: generateQueueItemId(),
  song,
  addedBy: {
    userId: addedBy.userId,
    userName: addedBy.userName,
    profilePic: addedBy.profilePic,
  },
  addedAt: Date.now(),
  status: 'pending',
  ...(isAutoRecommended ? { isAutoRecommended: true } : {}),
});

/**
 * Adds songs after everything else, or right after the current one with `next`. Skips ones
 * already queued and stops at the room's limit. Says why if nothing could be added.
 */
export const addSongs = (
  group: MusicGroup,
  songs: Array<Record<string, unknown>>,
  addedBy: GroupMember,
  options: { next?: boolean; isAutoRecommended?: boolean } = {}
): { added: QueueItem[]; error?: QueueError } => {
  const added: QueueItem[] = [];
  let error: QueueError | undefined;

  for (const song of songs) {
    const songId = songIdOf(song);
    if (!songId) {
      error ??= 'invalid';
      continue;
    }
    if (queueSize(group) >= group.settings.maxQueueSize) {
      error ??= 'queue-full';
      break;
    }
    if (hasSong(group, songId)) {
      error ??= 'duplicate';
      continue;
    }
    const item = createQueueItem(song, addedBy, options.isAutoRecommended);
    if (options.next) group.upcoming.splice(added.length, 0, item);
    else group.upcoming.push(item);
    added.push(item);
  }

  return added.length > 0 ? { added } : { added, error: error ?? 'invalid' };
};

/** People can take out what they added; the host can take out anything. */
export const removeUpcoming = (
  group: MusicGroup,
  itemId: string,
  userId: string | number
): QueueError | null => {
  const index = group.upcoming.findIndex((item) => item.id === itemId);
  if (index === -1) return 'not-found';
  const item = group.upcoming[index]!;
  if (String(item.addedBy.userId) !== String(userId) && !isHost(group, userId)) return 'forbidden';
  group.upcoming.splice(index, 1);
  return null;
};

/** Takes a song out of what's coming up, to play it now. */
export const takeUpcoming = (group: MusicGroup, itemId: string): QueueItem | null => {
  const index = group.upcoming.findIndex((item) => item.id === itemId);
  if (index === -1) return null;
  return group.upcoming.splice(index, 1)[0] ?? null;
};

/** By id rather than by position, so two people rearranging at once can't move the wrong song. */
export const moveUpcoming = (
  group: MusicGroup,
  itemId: string,
  toIndex: number
): QueueError | null => {
  const from = group.upcoming.findIndex((item) => item.id === itemId);
  if (from === -1) return 'not-found';
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= group.upcoming.length) {
    return 'invalid';
  }
  const [item] = group.upcoming.splice(from, 1);
  group.upcoming.splice(toIndex, 0, item!);
  return null;
};

export const shuffleUpcoming = (group: MusicGroup, random: () => number = Math.random): void => {
  const list = group.upcoming;
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
};

export const clearUpcoming = (group: MusicGroup): number => {
  const cleared = group.upcoming.length;
  group.upcoming = [];
  return cleared;
};
