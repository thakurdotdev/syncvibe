import { QueryTypes } from 'sequelize';
import { Song } from '@/models/index';
import sequelize from '@/utils/sequelize';
import {
  MIN_PLAYLIST_SONGS,
  buildSearchQueries,
  contentKey,
  isSingleArtist,
  type PlaylistSong,
} from './editorial-playlists.logic';

const SONG_API_URL = process.env.SONG_API_URL || 'https://song.thakur.dev';
const LANGUAGES = ['hindi', 'english', 'bhojpuri', 'punjabi'];
const ARTISTS_PER_LANGUAGE: Record<string, number> = {
  hindi: 150,
  english: 80,
  bhojpuri: 60,
  punjabi: 60,
};
const RESULTS_PER_SEARCH = 30;
const REQUEST_DELAY_MS = 250;

interface RawSong extends Record<string, unknown> {
  id?: string;
  download_url?: unknown[];
  artist_map?: { primary_artists?: Array<{ name?: string }> };
}

interface PlaylistSummary {
  id: string;
  name: string | null;
  owner: string | null;
}

export interface EditorialSyncStats {
  searches: number;
  playlistsFound: number;
  playlistsSaved: number;
  duplicatesSkipped: number;
  songsAddedToCatalog: number;
  errors: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchData = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(`${SONG_API_URL}${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return ((await response.json()) as { data?: T }).data ?? null;
};

const topArtists = async () => {
  const rows = await sequelize.query<{ language: string; artist: string; rank: string }>(
    `
    WITH artists AS (
      SELECT language, TRIM(UNNEST(STRING_TO_ARRAY("artistNames", ','))) AS artist, COUNT(*) AS songs
      FROM songs
      WHERE language IN (:languages)
      GROUP BY 1, 2
    )
    SELECT language, artist, ROW_NUMBER() OVER (PARTITION BY language ORDER BY songs DESC) AS rank
    FROM artists
    WHERE artist NOT IN ('', 'Unknown')
    `,
    { replacements: { languages: LANGUAGES }, type: QueryTypes.SELECT }
  );
  return rows.filter((row) => Number(row.rank) <= (ARTISTS_PER_LANGUAGE[row.language] ?? 0));
};

const discoverPlaylists = async (stats: EditorialSyncStats): Promise<PlaylistSummary[]> => {
  const found = new Map<string, PlaylistSummary>();
  const remember = (results: Array<Record<string, string>> | undefined) => {
    for (const playlist of results ?? []) {
      if (playlist.type === 'playlist' && playlist.id && !found.has(playlist.id)) {
        found.set(playlist.id, {
          id: playlist.id,
          name: playlist.name ?? null,
          owner: playlist.user_id ?? null,
        });
      }
    }
  };

  for (const query of buildSearchQueries(LANGUAGES, await topArtists())) {
    try {
      const data = await fetchData<{ results?: Array<Record<string, string>> }>(
        `/search/playlists?q=${encodeURIComponent(query)}&n=${RESULTS_PER_SEARCH}&page=1`
      );
      remember(data?.results);
      stats.searches += 1;
    } catch {
      stats.errors += 1;
    }
    await wait(REQUEST_DELAY_MS);
  }
  return [...found.values()];
};

const savePlaylist = async (playlist: PlaylistSummary, songs: PlaylistSong[]): Promise<void> => {
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `
      INSERT INTO editorial_playlists (id, name, owner, "isSingleArtist", "fetchedAt")
      VALUES (:id, :name, :owner, :isSingleArtist, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        owner = EXCLUDED.owner,
        "isSingleArtist" = EXCLUDED."isSingleArtist",
        "fetchedAt" = EXCLUDED."fetchedAt"
      `,
      {
        replacements: { ...playlist, isSingleArtist: isSingleArtist(songs) },
        type: QueryTypes.INSERT,
        transaction,
      }
    );
    await sequelize.query(`DELETE FROM editorial_playlist_songs WHERE "playlistId" = :id`, {
      replacements: { id: playlist.id },
      type: QueryTypes.DELETE,
      transaction,
    });
    const unique = [...new Map(songs.map((song) => [song.id, song])).values()];
    await sequelize.query(
      `
      INSERT INTO editorial_playlist_songs ("playlistId", "songId", position)
      SELECT :id, song_id, position - 1
      FROM UNNEST(ARRAY[:songIds]::varchar[]) WITH ORDINALITY AS t(song_id, position)
      `,
      {
        replacements: { id: playlist.id, songIds: unique.map((song) => song.id) },
        type: QueryTypes.INSERT,
        transaction,
      }
    );
  });
};

/**
 * Refreshes the stored playlists and adds their songs to the catalog. It runs one request at a
 * time and takes tens of minutes, so it's a command rather than part of the server.
 */
export const syncEditorialPlaylists = async (
  log: (message: string) => void = console.log
): Promise<EditorialSyncStats> => {
  const stats: EditorialSyncStats = {
    searches: 0,
    playlistsFound: 0,
    playlistsSaved: 0,
    duplicatesSkipped: 0,
    songsAddedToCatalog: 0,
    errors: 0,
  };

  const songsBefore = await Song.count();
  const playlists = await discoverPlaylists(stats);
  stats.playlistsFound = playlists.length;
  log(`Found ${playlists.length} playlists from ${stats.searches} searches`);

  const seenContent = new Set<string>();
  for (const [index, playlist] of playlists.entries()) {
    try {
      const data = await fetchData<{ songs?: RawSong[] }>(`/playlist?id=${playlist.id}`);
      const rawSongs = (data?.songs ?? []).filter((song) => song.id);
      const songs = rawSongs.map((song) => ({
        id: song.id!,
        primaryArtist: song.artist_map?.primary_artists?.[0]?.name ?? '',
      }));
      const key = contentKey(songs);
      if (seenContent.has(key)) {
        stats.duplicatesSkipped += 1;
      } else if (songs.length >= MIN_PLAYLIST_SONGS) {
        seenContent.add(key);
        const playable = rawSongs.filter((song) => (song.download_url?.length ?? 0) > 0);
        await Song.bulkGetOrCreate(playable);
        await savePlaylist(playlist, songs);
        stats.playlistsSaved += 1;
      }
    } catch (error) {
      stats.errors += 1;
      log(`Playlist ${playlist.id} failed: ${(error as Error).message}`);
    }
    if ((index + 1) % 100 === 0) log(`Processed ${index + 1}/${playlists.length} playlists`);
    await wait(REQUEST_DELAY_MS);
  }

  stats.songsAddedToCatalog = (await Song.count()) - songsBefore;
  log(`Done: ${JSON.stringify(stats)}`);
  return stats;
};
