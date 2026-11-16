import { Song } from '@/models/index';
import { cache } from '@/utils/redis';
import { loadSongData, type ListenerProfile } from './listener.service';
import { normalize } from './play-next.scoring';
import { artistWeights } from './recommendation.scoring';

type SongData = Record<string, unknown>;

const SONG_API_URL = process.env.SONG_API_URL || 'https://song.thakur.dev';
const ARTIST_CACHE_SECONDS = 12 * 60 * 60;
/** An artist with nothing new is asked again sooner, in case something comes out. */
const EMPTY_CACHE_SECONDS = 3 * 60 * 60;
const ARTISTS_CHECKED = 8;
const ALBUMS_PER_ARTIST = 4;
const MAX_PER_ARTIST = 3;
/** "New" is this year or last. Release years are all the song API gives for albums. */
const YEARS_BACK = 1;

interface Release {
  songId: string;
  /** Release date if known, else the year, so newer sorts first either way. */
  released: string;
}

const warming = new Set<string>();
const releaseKey = (artistId: string) => `artist-new:v1:${artistId}`;

const fetchData = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(`${SONG_API_URL}${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return ((await response.json()) as { data?: T }).data ?? null;
};

interface RawSong extends SongData {
  id?: string;
  release_date?: string;
  year?: string | number;
  download_url?: unknown[];
  artist_map?: { primary_artists?: Array<{ id?: string }> };
}

/** One artist's recent songs, from the song API, added to the catalog so they can be played. */
const fetchReleases = async (artistId: string): Promise<Release[]> => {
  const artist = await fetchData<{ latest_release?: Array<{ id?: string; year?: number }> }>(
    `/artist?id=${encodeURIComponent(artistId)}`
  );
  const oldest = new Date().getFullYear() - YEARS_BACK;
  const albums = (artist?.latest_release ?? [])
    .filter((album) => album.id && Number(album.year) >= oldest)
    .slice(0, ALBUMS_PER_ARTIST);

  const songs: RawSong[] = [];
  for (const album of albums) {
    const data = await fetchData<{ songs?: RawSong[] }>(
      `/album?id=${encodeURIComponent(album.id!)}`
    );
    songs.push(
      ...(data?.songs ?? []).filter(
        (song) =>
          song.id &&
          (song.download_url?.length ?? 0) > 0 &&
          // Albums credit many people; keep the songs this artist sings on.
          song.artist_map?.primary_artists?.some((credit) => credit.id === artistId)
      )
    );
  }
  if (songs.length > 0) await Song.bulkGetOrCreate(songs);
  return songs.map((song) => ({
    songId: song.id!,
    released: song.release_date || String(song.year ?? ''),
  }));
};

/** Fetches in the background: the shelf shows what's known now and fills in on a later visit. */
const warm = (artistId: string): void => {
  if (warming.has(artistId)) return;
  warming.add(artistId);
  fetchReleases(artistId)
    .then((releases) =>
      cache.set(
        releaseKey(artistId),
        releases,
        releases.length > 0 ? ARTIST_CACHE_SECONDS : EMPTY_CACHE_SECONDS
      )
    )
    .catch((err) => console.error(`[NewReleases] Artist ${artistId}:`, (err as Error).message))
    .finally(() => warming.delete(artistId));
};

/** The artists to check: the ones picked, then the ones played most lately. */
const artistsToCheck = (profile: ListenerProfile): string[] => {
  const weights = artistWeights(profile.listens, new Date());
  const idByName = new Map<string, string>();
  for (const listen of profile.listens) {
    if (listen.artistId) idByName.set(normalize(listen.artist), listen.artistId);
  }
  const played = [...weights.entries()]
    .sort((a, b) => b[1] - a[1])
    .flatMap(([name]) => {
      const id = idByName.get(name);
      return id ? [id] : [];
    });
  return [...new Set([...profile.taste.artists.map((artist) => artist.id), ...played])].slice(
    0,
    ARTISTS_CHECKED
  );
};

/** Recent songs by the artists this listener plays, that they haven't heard yet, newest first. */
export const newFromYourArtists = async (
  profile: ListenerProfile,
  limit = 20
): Promise<SongData[]> => {
  const artistIds = artistsToCheck(profile);
  const lists = await Promise.all(
    artistIds.map(async (artistId) => {
      const releases = await cache.get<Release[]>(releaseKey(artistId));
      if (!releases) warm(artistId);
      return releases ?? [];
    })
  );

  const seen = new Set<string>();
  const chosen = lists
    .flatMap((releases) =>
      releases
        .filter((release) => !profile.known.has(release.songId))
        .sort((a, b) => b.released.localeCompare(a.released))
        .slice(0, MAX_PER_ARTIST)
    )
    .filter((release) => !seen.has(release.songId) && seen.add(release.songId))
    .sort((a, b) => b.released.localeCompare(a.released))
    .slice(0, limit);
  return loadSongData(chosen.map((release) => release.songId));
};
