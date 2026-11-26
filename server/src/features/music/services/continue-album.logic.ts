/*
 * "Continue <album>": an album you've been playing through lately, and the songs of it still
 * ahead of you. Pure, so it's tested without the song API.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Plays older than this don't make an album "in progress". */
export const IN_PROGRESS_DAYS = 14;
/** Played this many different songs of it: you're listening to the album, not one hit. */
const MIN_PLAYED = 2;
/** Fewer than this left isn't worth a shelf. */
const MIN_LEFT = 2;

export interface AlbumPlay {
  songId: string;
  albumId: string;
  playedAt: Date;
}

/** Albums you've been playing through lately, the most recently played first. */
export const albumsInProgress = (plays: AlbumPlay[], now = new Date()): string[] => {
  const since = now.getTime() - IN_PROGRESS_DAYS * DAY_MS;
  const byAlbum = new Map<string, { songs: Set<string>; last: number }>();
  for (const play of plays) {
    const at = new Date(play.playedAt).getTime();
    if (!play.albumId || at < since) continue;
    const entry = byAlbum.get(play.albumId) ?? { songs: new Set<string>(), last: 0 };
    entry.songs.add(play.songId);
    entry.last = Math.max(entry.last, at);
    byAlbum.set(play.albumId, entry);
  }
  return [...byAlbum.entries()]
    .filter(([, { songs }]) => songs.size >= MIN_PLAYED)
    .sort((a, b) => b[1].last - a[1].last)
    .map(([albumId]) => albumId);
};

/**
 * What's left of an album in its own order: the songs after the furthest one you've played that
 * you haven't heard. Null when there's too little left to offer.
 */
export const restOfAlbum = (trackIds: string[], played: ReadonlySet<string>): string[] | null => {
  let furthest = -1;
  trackIds.forEach((id, index) => {
    if (played.has(id)) furthest = index;
  });
  if (furthest === -1) return null;
  const rest = trackIds.slice(furthest + 1).filter((id) => !played.has(id));
  return rest.length >= MIN_LEFT ? rest : null;
};
