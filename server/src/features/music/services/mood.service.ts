import { QueryTypes } from 'sequelize';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';
import { withoutBlockedArtists } from './artist-block.logic';
import { languagesOf, loadSongData, type ListenerProfile } from './listener.service';
import { MOODS, moodByKey } from './moods';
import { cleanTitle, normalize } from './play-next.scoring';
import { artistWeights } from './recommendation.scoring';

type SongData = Record<string, unknown>;

const STATION_CACHE_SECONDS = 24 * 60 * 60;
const STATION_POOL = 400;
const MAX_PER_SINGER = 2;
const RECENT_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface StationRow {
  songId: string;
  name: string;
  singer: string;
  /** How many of the mood's playlists hold it. */
  lists: number;
}

/**
 * Each song's mood: the one most of its editor playlists share. Songs no mood playlist holds are
 * left out. One query, since a mix needs the moods of a whole history at once.
 */
export const songMoods = async (songIds: string[]): Promise<Map<string, string>> => {
  if (songIds.length === 0) return new Map();
  try {
    const rows = await sequelize.query<{ songId: string; mood: string; lists: string }>(
      `
      WITH moods(key, pattern) AS (
        SELECT * FROM UNNEST(ARRAY[:keys]::text[], ARRAY[:patterns]::text[])
      )
      SELECT ps."songId", m.key AS mood, COUNT(*) AS lists
      FROM editorial_playlist_songs ps
      JOIN editorial_playlists p ON p.id = ps."playlistId" AND NOT p."isSingleArtist"
      JOIN moods m ON p.name ~* m.pattern
      WHERE ps."songId" IN (:songIds)
      GROUP BY 1, 2
      `,
      {
        replacements: {
          keys: MOODS.map((mood) => mood.key),
          patterns: MOODS.map((mood) => mood.pattern),
          songIds,
        },
        type: QueryTypes.SELECT,
      }
    );
    const best = new Map<string, { mood: string; lists: number }>();
    for (const row of rows) {
      const lists = Number(row.lists);
      const current = best.get(row.songId);
      if (!current || lists > current.lists) best.set(row.songId, { mood: row.mood, lists });
    }
    return new Map([...best.entries()].map(([songId, { mood }]) => [songId, mood]));
  } catch (err) {
    // The editorial tables may be missing on a dev database: no moods, nothing else breaks.
    console.error('[Moods] Lookup failed:', (err as Error).message);
    return new Map();
  }
};

/** A mood's songs in these languages, the ones on most of its playlists first. Shared by all. */
const stationPool = async (moodKey: string, languages: string[]): Promise<StationRow[]> => {
  const mood = moodByKey(moodKey);
  if (!mood) return [];
  const key = `mood:v1:${mood.key}:${[...languages].sort().join(',')}`;
  const cached = await cache.get<StationRow[]>(key);
  if (cached) return cached;

  const rows = await sequelize.query<StationRow & { lists: string }>(
    `
    SELECT s."songId", s.name,
      COALESCE(s."songData"#>>'{artist_map,primary_artists,0,name}', s."artistNames") AS singer,
      COUNT(DISTINCT p.id) AS lists
    FROM editorial_playlists p
    JOIN editorial_playlist_songs ps ON ps."playlistId" = p.id
    JOIN songs s ON s."songId" = ps."songId"
    WHERE NOT p."isSingleArtist" AND p.name ~* :pattern AND s.language IN (:languages)
      AND jsonb_array_length(COALESCE(s."songData"->'download_url', '[]'::jsonb)) > 0
    GROUP BY s.id
    ORDER BY lists DESC,
      MAX(CASE WHEN s."songData"->>'play_count' ~ '^[0-9]+$'
        THEN (s."songData"->>'play_count')::bigint ELSE 0 END) DESC
    LIMIT :limit
    `,
    {
      replacements: { pattern: mood.pattern, languages, limit: STATION_POOL },
      type: QueryTypes.SELECT,
    }
  );
  const pool = rows.map((row) => ({ ...row, lists: Number(row.lists) }));
  if (pool.length > 0) await cache.set(key, pool, STATION_CACHE_SECONDS);
  return pool;
};

// FNV-1a: a stable number in [0, 1) for a string, so a station changes daily, not every visit.
const unitHash = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
};

/**
 * A mood's station for one listener: in their languages, with artists they play nearer the top,
 * songs they disliked or played in the last few days left out, and no more than two per singer.
 */
export const moodStation = async (
  moodKey: string,
  profile: ListenerProfile | null,
  limit = 30
): Promise<SongData[]> => {
  const languages = profile ? languagesOf(profile) : ['hindi', 'english'];
  const pool = await stationPool(moodKey, languages);
  if (pool.length === 0) return [];

  const now = new Date();
  const affinity = profile ? artistWeights(profile.listens, now) : new Map<string, number>();
  const recent = new Set(
    (profile?.listens ?? [])
      .filter(
        (listen) => now.getTime() - new Date(listen.lastPlayedAt).getTime() < RECENT_DAYS * DAY_MS
      )
      .map((listen) => listen.songId)
  );
  const day = now.toISOString().slice(0, 10);

  const ranked = pool
    .filter(
      (row) =>
        !profile?.dislikes.songIds.has(row.songId) &&
        !profile?.dislikes.titles.has(cleanTitle(row.name))
    )
    .map((row) => ({
      row,
      value:
        Math.log2(1 + row.lists) *
        (1 + 0.6 * (affinity.get(normalize(row.singer)) ?? 0)) *
        (recent.has(row.songId) ? 0.3 : 1) *
        (0.6 + 0.8 * unitHash(`${profile?.userId ?? 0}:${day}:${row.songId}`)),
    }))
    .sort((a, b) => b.value - a.value);

  const perSinger = new Map<string, number>();
  const titles = new Set<string>();
  const chosen: string[] = [];
  for (const { row } of ranked) {
    if (chosen.length >= limit) break;
    const singer = normalize(row.singer);
    const title = cleanTitle(row.name);
    if ((perSinger.get(singer) ?? 0) >= MAX_PER_SINGER || titles.has(title)) continue;
    perSinger.set(singer, (perSinger.get(singer) ?? 0) + 1);
    titles.add(title);
    chosen.push(row.songId);
  }
  const songs = await loadSongData(chosen);
  return profile ? withoutBlockedArtists(songs, profile.dislikes.artistIds) : songs;
};

export const listMoods = () => MOODS.map(({ key, title }) => ({ key, title }));
