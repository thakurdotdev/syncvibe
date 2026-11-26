import type { Regular, SavedRoomSettings } from '@/models/music/saved-room.model';
import { songIdOf } from './queue';
import type { MusicGroup } from './state';

/*
 * What a kept room carries between sessions, taken from a live room, and how a new live room picks
 * it up again. Writing it to the database is `effects.saveRoom`.
 */

export const MAX_REGULARS = 30;
export const MAX_SAVED_SONGS = 50;
/** Rooms one person can keep. */
export const MAX_SAVED_ROOMS = 20;

/** A live room's link to the room it was opened from. */
export interface SavedRoomLink {
  id: number;
  ownerId: string;
  /** People who have been in it, most recent first; the owner isn't one. */
  regulars: Regular[];
}

export interface SavedSnapshot {
  name: string;
  settings: SavedRoomSettings;
  coHostIds: string[];
  regulars: Regular[];
  queue: Array<Record<string, unknown>>;
}

export const settingsToKeep = (group: MusicGroup): SavedRoomSettings => ({
  controlMode: group.settings.controlMode,
  autoPlayRecommendations: group.settings.autoPlayRecommendations,
  fairQueue: group.settings.fairQueue,
  approveSongs: group.settings.approveSongs,
});

/** Everyone in the room now, then those from before, once each and without the owner. */
export const mergeRegulars = (known: Regular[], group: MusicGroup, ownerId: string): Regular[] => {
  const seen = new Set<string>([ownerId]);
  const merged: Regular[] = [];
  const take = (regular: Regular) => {
    if (seen.has(regular.userId)) return;
    seen.add(regular.userId);
    merged.push(regular);
  };
  for (const member of group.members) {
    take({
      userId: String(member.userId),
      userName: member.userName,
      ...(member.profilePic ? { profilePic: member.profilePic } : {}),
    });
  }
  known.forEach(take);
  return merged.slice(0, MAX_REGULARS);
};

/** What to keep of a live room: its setup, its people and what's playing and queued. */
export const savedSnapshotOf = (group: MusicGroup, ownerId: string): SavedSnapshot => ({
  name: group.name,
  settings: settingsToKeep(group),
  coHostIds: [...group.coHosts],
  regulars: mergeRegulars(group.savedRoom?.regulars ?? [], group, ownerId),
  queue: [group.current, ...group.upcoming]
    .map((item) => item?.song)
    .filter((song): song is Record<string, unknown> => Boolean(song && songIdOf(song)))
    .slice(0, MAX_SAVED_SONGS),
});

/** A new live room takes the kept room's setup. The plan still decides the queue's size. */
export const applySavedSettings = (group: MusicGroup, settings: SavedRoomSettings): void => {
  if (settings.controlMode === 'host' || settings.controlMode === 'everyone') {
    group.settings.controlMode = settings.controlMode;
  }
  if (typeof settings.autoPlayRecommendations === 'boolean') {
    group.settings.autoPlayRecommendations = settings.autoPlayRecommendations;
  }
  if (typeof settings.fairQueue === 'boolean') group.settings.fairQueue = settings.fairQueue;
  if (typeof settings.approveSongs === 'boolean') {
    group.settings.approveSongs = settings.approveSongs;
  }
};
