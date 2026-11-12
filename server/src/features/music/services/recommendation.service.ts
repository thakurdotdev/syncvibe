import { Op } from 'sequelize';
import { HistorySong, Song } from '@/models/index';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';
import { getDislikes } from './dislike.service';
import { getRelatedSongIds } from './play-next.service';
import { cleanTitle } from './play-next.scoring';
import {
  dropKnownTitles,
  fuseRelated,
  pickFavourites,
  pickForDay,
  pickSeeds,
  toUnitScores,
  type Listen,
  type Pick,
} from './recommendation.scoring';

type SongData = Record<string, unknown>;

const CACHE_TTL_SECONDS = 6 * 60 * 60;
/** Fetched before other versions of heard songs are dropped, so it is larger than the pool. */
const NEW_SONGS_FETCHED = 150;
const NEW_SONGS_IN_POOL = 60;
const FAVOURITES_IN_POOL = 20;
const pendingUsers = new Set<number>();
const building = new Map<number, Promise<Pick<SongData>[]>>();

const poolKey = (userId: number): string => `recs:${userId}:mix`;

/**
 * `artistNames` often starts with a composer or an actor, so the singer is read from the song
 * itself. Selected as a column because a long history shouldn't load every song's full data.
 */
const SINGER = [
  sequelize.literal(`"songData"#>>'{artist_map,primary_artists,0,name}'`),
  'singer',
] as const;

type WithSinger<T> = T & { singer: string | null };

const artistOf = (song: { singer: string | null; artistNames: string | null }): string =>
  song.singer || (song.artistNames || '').split(',')[0]!.trim();

const loadListens = async (userId: number): Promise<Listen[]> => {
  const rows = await HistorySong.findAll({
    where: { userId },
    attributes: ['songRefId', 'playedCount', 'completionRate', 'skipCount', 'lastPlayedAt'],
    raw: true,
  });
  if (rows.length === 0) return [];

  const songs = (await Song.findAll({
    where: { id: { [Op.in]: rows.map((row) => row.songRefId) } },
    attributes: ['id', 'songId', 'name', 'artistNames', [...SINGER]],
    raw: true,
  })) as unknown as Array<WithSinger<Song>>;
  const songsByRef = new Map(songs.map((song) => [song.id, song]));

  return rows.flatMap((row) => {
    const song = songsByRef.get(row.songRefId);
    if (!song) return [];
    return {
      songId: song.songId,
      name: song.name || '',
      artist: artistOf(song),
      playedCount: row.playedCount || 1,
      completionRate: row.completionRate || 0,
      skipCount: row.skipCount || 0,
      lastPlayedAt: row.lastPlayedAt,
    };
  });
};

const loadPicks = async (
  ranked: Array<{ songId: string; score: number }>,
  kind: Pick['kind']
): Promise<Pick<SongData>[]> => {
  if (ranked.length === 0) return [];
  const songs = (await Song.findAll({
    where: { songId: { [Op.in]: ranked.map((item) => item.songId) } },
    attributes: ['songId', 'name', 'artistNames', 'songData', [...SINGER]],
    raw: true,
  })) as unknown as Array<WithSinger<Song>>;
  const songsById = new Map(songs.map((song) => [song.songId, song]));

  return ranked.flatMap(({ songId, score }) => {
    const song = songsById.get(songId);
    if (!song) return [];
    return {
      songId,
      name: song.name || '',
      artist: artistOf(song),
      score,
      kind,
      song: song.songData as SongData,
    };
  });
};

/**
 * Everything worth showing this listener: new songs related to what they play most now, and
 * favourites they haven't played for a while. Each day's list is drawn from it.
 */
const computePool = async (userId: number): Promise<Pick<SongData>[]> => {
  const [allListens, dislikes] = await Promise.all([loadListens(userId), getDislikes(userId)]);
  // A disliked song can't lead to similar songs or come back as a favourite.
  const listens = allListens.filter((listen) => !dislikes.songIds.has(listen.songId));
  if (listens.length === 0) return [];

  const now = new Date();
  const seeds = pickSeeds(listens, now);
  const relatedBySeed = new Map<string, string[]>();
  // One at a time: a seed that isn't cached yet costs several catalog searches.
  for (const seed of seeds) {
    relatedBySeed.set(seed.songId, await getRelatedSongIds(seed.songId));
  }

  const heard = new Set([...allListens.map((listen) => listen.songId), ...dislikes.songIds]);
  const fused = fuseRelated(seeds, relatedBySeed, heard).slice(0, NEW_SONGS_FETCHED);
  const fresh = dropKnownTitles(
    (await loadPicks(fused, 'new')).filter((pick) => !dislikes.titles.has(cleanTitle(pick.name))),
    allListens.map((listen) => listen.name)
  ).slice(0, NEW_SONGS_IN_POOL);

  const favourites = await loadPicks(
    pickFavourites(listens, now).slice(0, FAVOURITES_IN_POOL),
    'favourite'
  );

  return [...toUnitScores(fresh), ...toUnitScores(favourites)];
};

const buildPool = (userId: number): Promise<Pick<SongData>[]> => {
  const running = building.get(userId);
  if (running) return running;

  const build = computePool(userId)
    .then(async (pool) => {
      await cache.set(poolKey(userId), pool, CACHE_TTL_SECONDS);
      return pool;
    })
    .finally(() => building.delete(userId));
  building.set(userId, build);
  return build;
};

export const getRecommendationsForUser = async (
  userId: number,
  limit = 12
): Promise<SongData[]> => {
  const cached = await cache.get<Pick<SongData>[]>(poolKey(userId));
  const pool = cached && cached.length > 0 ? cached : await buildPool(userId);

  const day = new Date().toISOString().slice(0, 10);
  return pickForDay(pool, limit, `${userId}:${day}`).map((pick) => pick.song);
};

export const getRecentlyPlayed = async (userId: number, limit = 15): Promise<SongData[]> => {
  const recent = await HistorySong.findAll({
    where: { userId },
    attributes: ['songRefId'],
    order: [['lastPlayedAt', 'DESC']],
    limit,
    raw: true,
  });
  if (recent.length === 0) return [];

  const songs = await Song.findAll({
    where: { id: { [Op.in]: recent.map((row) => row.songRefId) } },
    attributes: ['id', 'songData'],
    raw: true,
  });
  const dataByRef = new Map(songs.map((song) => [song.id, song.songData as SongData]));
  return recent
    .map((row) => dataByRef.get(row.songRefId))
    .filter((data): data is SongData => !!data);
};

export const queueUserForRecalc = (userId: number): void => {
  pendingUsers.add(userId);
};

const processPendingRecalculations = async (): Promise<void> => {
  if (pendingUsers.size === 0) return;

  const usersToProcess = [...pendingUsers];
  pendingUsers.clear();

  for (const userId of usersToProcess) {
    try {
      await buildPool(userId);
    } catch (err) {
      console.error(`Failed to recalc recommendations for user ${userId}:`, (err as Error).message);
    }
  }
};

let recalcInterval: ReturnType<typeof setInterval> | null = null;

export const startBackgroundRecalc = (intervalMs = 60000): void => {
  if (recalcInterval) return;

  recalcInterval = setInterval(() => {
    processPendingRecalculations().catch(console.error);
  }, intervalMs);

  console.log(`Recommendation recalc job started (interval: ${intervalMs}ms)`);
};

export const stopBackgroundRecalc = (): void => {
  if (recalcInterval) {
    clearInterval(recalcInterval);
    recalcInterval = null;
    console.log('Recommendation recalc job stopped');
  }
};

export const invalidateCache = async (userId: number): Promise<void> => {
  await cache.del(poolKey(userId));
};
