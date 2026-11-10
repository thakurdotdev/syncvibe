/** Pure rules for editorial playlists, kept apart from network and database access. */

export const MIN_PLAYLIST_SONGS = 5;
const SINGLE_ARTIST_SHARE = 0.5;

const SEARCH_TERMS = [
  'romantic',
  'love songs',
  'sad songs',
  'heartbreak',
  'party',
  'dance',
  'wedding',
  'bhajan',
  'devotional',
  'sufi',
  'qawwali',
  'chill',
  'lofi',
  'acoustic',
  'unplugged',
  'workout',
  'gym',
  'road trip',
  'rain monsoon',
  'retro',
  'old classics',
  '90s',
  '80s',
  '2000s',
  '2010s',
  '2020s',
  'hits',
  'top 50',
  'trending',
  'best of',
  'indie',
  'pop',
  'rock',
  'hip hop',
  'rap',
  'folk',
  'holi',
  'festival',
  'morning',
  'night',
  'sleep',
  'study',
  'motivational',
  'item songs',
  'film soundtrack',
  'evergreen',
  'bollywood',
  'remix',
];

export interface PlaylistSong {
  id: string;
  primaryArtist: string;
}

export const buildSearchQueries = (
  languages: string[],
  artists: Array<{ language: string; artist: string }>
): string[] => [
  ...SEARCH_TERMS.flatMap((term) => languages.map((language) => `${term} ${language}`)),
  ...artists.map(({ artist, language }) => `${artist} ${language}`),
];

/** Same songs in any order give the same key, so re-published copies only count once. */
export const contentKey = (songs: PlaylistSong[]): string =>
  songs
    .map((song) => song.id)
    .sort()
    .join(',');

export const isSingleArtist = (songs: PlaylistSong[]): boolean => {
  if (songs.length === 0) return false;
  const counts = new Map<string, number>();
  for (const song of songs)
    counts.set(song.primaryArtist, (counts.get(song.primaryArtist) ?? 0) + 1);
  return Math.max(...counts.values()) / songs.length > SINGLE_ARTIST_SHARE;
};
