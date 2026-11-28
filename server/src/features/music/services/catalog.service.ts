import { Song } from '@/models/index';

/*
 * The catalog is shared: a song in it shows up in other people's search and suggestions. So a
 * device only names the song. One we don't hold is added only if the song API knows it, and what
 * is stored is the API's copy, never the device's: otherwise anyone could add a song with links
 * and details of their own choosing.
 */

const SONG_API_URL = process.env.SONG_API_URL || 'https://song.thakur.dev';
const TIMEOUT_MS = 8_000;
const SONG_ID = /^[\w-]{1,64}$/;

type SongData = Record<string, unknown>;

export class UnknownSongError extends Error {
  constructor() {
    super('Song not found');
  }
}

/** The API's copy of a song, or null if it has no such song. Throws if it couldn't be asked. */
const fetchSong = async (songId: string): Promise<SongData | null> => {
  const response = await fetch(`${SONG_API_URL}/song?id=${encodeURIComponent(songId)}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // The API answers 400 for an id it doesn't know.
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new Error(`Song API answered ${response.status}`);
  const body = (await response.json()) as { data?: { songs?: SongData[] } };
  return body.data?.songs?.find((song) => String(song.id) === songId) ?? null;
};

/** The catalog's row for the song a device named, adding it from the song API if it's new. */
export const catalogSong = async (named: unknown): Promise<Song> => {
  const id = (named as { id?: unknown } | null | undefined)?.id;
  const songId = typeof id === 'string' || typeof id === 'number' ? String(id) : '';
  if (!SONG_ID.test(songId)) throw new UnknownSongError();

  const stored = await Song.findOne({ where: { songId } });
  if (stored) return stored;

  const song = await fetchSong(songId);
  if (!song) throw new UnknownSongError();
  return Song.getOrCreate({ ...song, id: songId });
};
