import type { MusicGroup, QueueItem } from './state';

/**
 * What the room engine needs from the rest of the server. Kept apart from it so the engine can be
 * tested without a database; the real ones are set in `effects.live.ts`.
 */
export const effects = {
  recommend: async (_options: {
    baseSongId: string;
    limit: number;
    excludeSongIds: string[];
    /** Who is in the room, so autoplay suits all of them. */
    listenerIds: number[];
  }): Promise<Array<Record<string, unknown>>> => [],
  recordPlayed: async (_group: MusicGroup, _item: QueueItem): Promise<void> => {},
  /** Writes a kept room's copy; `ended`: the live room is gone, so it's no longer live. */
  saveRoom: async (_group: MusicGroup, _ended: boolean): Promise<void> => {},
};
