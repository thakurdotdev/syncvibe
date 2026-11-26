/*
 * "Not this artist": which artists a song is by, for leaving out the ones a listener blocked.
 * Lyricists and actors don't count; a song they only wrote or appear in isn't theirs to hear.
 */

type SongData = Record<string, unknown>;

interface SongArtist {
  id?: unknown;
  role?: unknown;
}

const NOT_PERFORMING = /lyricist|starring|actor/;

/** The artist ids a song is by: singers, primary artists and composers. */
export const artistIdsOf = (song: SongData): string[] => {
  const map = (song.artist_map ?? {}) as Record<string, unknown>;
  const all = [
    ...((map.primary_artists as SongArtist[]) ?? []),
    ...((map.artists as SongArtist[]) ?? []),
  ];
  const ids = new Set<string>();
  for (const artist of all) {
    if (!artist || artist.id == null || artist.id === '') continue;
    if (NOT_PERFORMING.test(String(artist.role ?? '').toLowerCase())) continue;
    ids.add(String(artist.id));
  }
  return [...ids];
};

/** The songs left once those by blocked artists are taken out, in the same order. */
export const withoutBlockedArtists = <T extends SongData>(
  songs: T[],
  blocked: ReadonlySet<string>
): T[] =>
  blocked.size === 0
    ? songs
    : songs.filter((song) => !artistIdsOf(song).some((id) => blocked.has(id)));
