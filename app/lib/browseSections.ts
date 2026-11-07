import type { Album, Artist, Playlist } from '@/types/music';
import type { Song } from '@/types/song';

export type BrowseItem =
  | { kind: 'song'; key: string; song: Song }
  | { kind: 'album'; key: string; album: Album }
  | { kind: 'playlist'; key: string; playlist: Playlist }
  | { kind: 'artist'; key: string; artist: Artist };

export type BrowseSection = { key: string; title: string; items: BrowseItem[] };

/** Fewer than this looks like a mistake rather than a row. */
const MIN_ITEMS = 2;

/** Titles that describe something the app does differently from the service it comes from. */
const TITLE_OVERRIDES: Record<string, string> = {
  artist_recos: 'Artists to know',
};

const decodeEntities = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const toItem = (raw: any): BrowseItem | null => {
  if (!raw?.id || !raw?.name || !raw?.image) return null;
  const key = `${raw.type}-${raw.id}`;
  const shown = { ...raw, name: decodeEntities(String(raw.name)) };
  switch (raw.type) {
    case 'song':
      return { kind: 'song', key, song: shown };
    case 'album':
      return { kind: 'album', key, album: shown };
    case 'playlist':
      return { kind: 'playlist', key, playlist: shown };
    case 'artist':
      return { kind: 'artist', key, artist: shown };
    case 'radio_station':
      // An artist's station has the artist's own id, so it opens their page.
      return raw.featured_station_type === 'artist'
        ? { kind: 'artist', key: `artist-${raw.id}`, artist: shown }
        : null;
    // Podcasts, other radio stations, moods and anything added later: nothing here can open them.
    default:
      return null;
  }
};

/**
 * Turns the home API into rows. Its sections change by language and over time: `promo3` is podcasts
 * for one language and K-Pop for another, and seasonal ones come and go. So nothing here depends on
 * a section's key. Title and order come from the response, and a section shows if it has enough
 * that the app can open.
 */
export const toBrowseSections = (modules: unknown): BrowseSection[] => {
  if (!modules || typeof modules !== 'object') return [];

  return Object.entries(modules as Record<string, any>)
    .filter(([, section]) => Array.isArray(section?.data))
    .sort(([, a], [, b]) => (Number(a.position) || 0) - (Number(b.position) || 0))
    .map(([key, section]) => {
      const seen = new Set<string>();
      const items: BrowseItem[] = [];
      for (const raw of section.data) {
        const item = toItem(raw);
        if (item && !seen.has(item.key)) {
          seen.add(item.key);
          items.push(item);
        }
      }
      return {
        key,
        title: TITLE_OVERRIDES[key] ?? decodeEntities(String(section.title ?? '')),
        items,
      };
    })
    .filter((section) => section.title.trim() && section.items.length >= MIN_ITEMS);
};
