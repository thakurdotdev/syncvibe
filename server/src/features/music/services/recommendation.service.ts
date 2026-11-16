import { Op } from 'sequelize';
import { HistorySong, Song } from '@/models/index';
import { cache } from '@/utils/redis';
import { getRelatedSongIds } from './play-next.service';
import { cleanTitle } from './play-next.scoring';
import {
  artistOf,
  languagesOf,
  loadProfile,
  SINGER,
  songsOfArtists,
  type ListenerProfile,
} from './listener.service';
import {
  dropKnownTitles,
  fuseRelated,
  pickFavourites,
  pickForDay,
  pickSeeds,
  toUnitScores,
  type Fused,
  type Pick,
  type Seed,
} from './recommendation.scoring';

type SongData = Record<string, unknown>;

const CACHE_TTL_SECONDS = 6 * 60 * 60;
/** Fetched before other versions of heard songs are dropped, so it is larger than the pool. */
const NEW_SONGS_FETCHED = 150;
const NEW_SONGS_IN_POOL = 60;
const FAVOURITES_IN_POOL = 20;
/** Below this many songs, the artists someone picked say more than their plays do. */
const FEW_LISTENS = 8;
/** Songs outside the chosen languages still show, just much less often. */
const OTHER_LANGUAGE_WEIGHT = 0.3;
const pendingUsers = new Set<number>();
const building = new Map<number, Promise<Pick<SongData>[]>>();
const invalidationHooks = new Set<(userId: number) => Promise<void>>();

const poolKey = (userId: number): string => `recs:${userId}:mix2`;

type WithSinger<T> = T & { singer: string | null };

export const loadPicks = async (
  ranked: Array<{ songId: string; score: number; reason?: string }>,
  kind: Pick['kind']
): Promise<Pick<SongData>[]> => {
  if (ranked.length === 0) return [];
  const songs = (await Song.findAll({
    where: { songId: { [Op.in]: ranked.map((item) => item.songId) } },
    attributes: ['songId', 'name', 'artistNames', 'songData', [...SINGER]],
    raw: true,
  })) as unknown as Array<WithSinger<Song>>;
  const songsById = new Map(songs.map((song) => [song.songId, song]));

  return ranked.flatMap(({ songId, score, reason }) => {
    const song = songsById.get(songId);
    if (!song) return [];
    return {
      songId,
      name: song.name || '',
      artist: artistOf(song),
      score,
      kind,
      song: song.songData as SongData,
      ...(reason ? { reason } : {}),
    };
  });
};

/** What led to a recommendation, in the words shown under it. */
export const reasonFor = (
  seedId: string,
  profile: ListenerProfile,
  artistSeeds: Map<string, string>
): string | undefined => {
  const artist = artistSeeds.get(seedId);
  if (artist) return `Because you like ${artist}`;
  const listen = profile.listens.find((item) => item.songId === seedId);
  if (!listen?.name) return undefined;
  return listen.liked ? `Because you liked ${listen.name}` : `Because you played ${listen.name}`;
};

/** The seeds' related songs, fused, with the listener's unheard songs only and reasons attached. */
export const relatedTo = async (
  seeds: Seed[],
  profile: ListenerProfile,
  artistSeeds = new Map<string, string>()
): Promise<Array<Fused & { reason?: string }>> => {
  const relatedBySeed = new Map<string, string[]>();
  // One at a time: a seed that isn't cached yet costs several catalog searches.
  for (const seed of seeds) {
    relatedBySeed.set(seed.songId, await getRelatedSongIds(seed.songId));
  }
  return fuseRelated(seeds, relatedBySeed, profile.known).map((item) => ({
    ...item,
    reason: reasonFor(item.seedId, profile, artistSeeds),
  }));
};

/** Seeds from the artists someone picked, for a listener with little history of their own. */
const artistSeedsOf = async (
  profile: ListenerProfile
): Promise<{ seeds: Seed[]; names: Map<string, string> }> => {
  const artists = profile.taste.artists.slice(0, 6);
  if (artists.length === 0 || profile.listens.length >= FEW_LISTENS) {
    return { seeds: [], names: new Map() };
  }
  const songIds = await songsOfArtists(artists, 2);
  const facts = await Song.findAll({
    where: { songId: { [Op.in]: songIds } },
    attributes: ['songId', [...SINGER]],
    raw: true,
  });
  const names = new Map(
    (facts as unknown as Array<{ songId: string; singer: string | null }>).map((row) => [
      row.songId,
      row.singer || 'this artist',
    ])
  );
  return {
    seeds: songIds
      .filter((id) => !profile.known.has(id))
      .map((songId) => ({ songId, weight: 0.6 })),
    names,
  };
};

/** Moves songs outside the listener's chosen languages down, without hiding them. */
const preferLanguages = (picks: Pick<SongData>[], languages: string[]): Pick<SongData>[] => {
  if (languages.length === 0) return picks;
  const wanted = new Set(languages);
  return picks.map((pick) => {
    const language = (pick.song as { language?: string }).language;
    return language && !wanted.has(language)
      ? { ...pick, score: pick.score * OTHER_LANGUAGE_WEIGHT }
      : pick;
  });
};

/**
 * Everything worth showing this listener: new songs related to what they play most now, and
 * favourites they haven't played for a while. Each day's list is drawn from it.
 */
const computePool = async (userId: number): Promise<Pick<SongData>[]> => {
  const profile = await loadProfile(userId);
  const { listens } = profile;
  const fromArtists = await artistSeedsOf(profile);
  if (listens.length === 0 && fromArtists.seeds.length === 0) return [];

  const now = new Date();
  const seeds = [...pickSeeds(listens, now), ...fromArtists.seeds];
  const fused = (await relatedTo(seeds, profile, fromArtists.names)).slice(0, NEW_SONGS_FETCHED);
  const fresh = dropKnownTitles(
    (await loadPicks(fused, 'new')).filter(
      (pick) => !profile.dislikes.titles.has(cleanTitle(pick.name))
    ),
    listens.map((listen) => listen.name)
  ).slice(0, NEW_SONGS_IN_POOL);

  const favourites = await loadPicks(
    pickFavourites(listens, now)
      .slice(0, FAVOURITES_IN_POOL)
      .map((item) => ({ ...item, reason: 'One of your favourites' })),
    'favourite'
  );

  const languages = profile.taste.languages.length > 0 ? languagesOf(profile) : [];
  return [...toUnitScores(preferLanguages(fresh, languages)), ...toUnitScores(favourites)];
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

/** Today's "Made for you", with why each song is there, keyed by song id. */
export const getRecommendationsForUser = async (
  userId: number,
  limit = 12
): Promise<{ songs: SongData[]; reasons: Record<string, string> }> => {
  const cached = await cache.get<Pick<SongData>[]>(poolKey(userId));
  const pool = cached && cached.length > 0 ? cached : await buildPool(userId);

  const day = new Date().toISOString().slice(0, 10);
  const picks = pickForDay(pool, limit, `${userId}:${day}`);
  return {
    songs: picks.map((pick) => pick.song),
    reasons: Object.fromEntries(
      picks.flatMap((pick) => (pick.reason ? [[pick.songId, pick.reason]] : []))
    ),
  };
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

/** Lets other caches built from the same taste (the home shelves) be cleared along with it. */
export const onInvalidate = (clear: (userId: number) => Promise<void>): void => {
  invalidationHooks.add(clear);
};

export const invalidateCache = async (userId: number): Promise<void> => {
  await Promise.all([
    cache.del(poolKey(userId)),
    ...[...invalidationHooks].map((clear) => clear(userId)),
  ]);
};
