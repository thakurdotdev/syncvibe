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
  }): Promise<Array<Record<string, unknown>>> => [],
  recordPlayed: async (_group: MusicGroup, _item: QueueItem): Promise<void> => {},
};
