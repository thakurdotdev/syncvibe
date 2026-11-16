import { QueryTypes } from 'sequelize';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';
import { listLikedSongs } from './like.service';
import { loadProfile, loadSongData, loadSongFacts, type ListenerProfile } from './listener.service';
import { moodByKey } from './moods';
import { songMoods } from './mood.service';
import { newFromYourArtists } from './new-releases.service';
import {
  describeArtists,
  HOUR_BANDS,
  hourBandOf,
  interleave,
  leadArtists,
  mixGroups,
  type HourBand,
  type MixGroup,
} from './personal.scoring';
import { cleanTitle, normalize } from './play-next.scoring';
import { engagement, pickFavourites, pickSeeds } from './recommendation.scoring';
import { onInvalidate, relatedTo } from './recommendation.service';

type SongData = Record<string, unknown>;

export interface Shelf {
  key: string;
  title: string;
  subtitle?: string;
  songs: SongData[];
  /** Song id to why it's there. */
  reasons?: Record<string, string>;
}

const SHELF_CACHE_SECONDS = 3 * 60 * 60;
const MIX_SONGS = 24;
const MIX_SEEDS = 6;
const MIX_NEW_PER_ARTIST = 2;
/** One song the listener knows after every two new ones. */
const MIX_FAMILIAR_EVERY = 2;
const SAME_MOOD_BOOST = 1.6;
const OTHER_MOOD_WEIGHT = 0.5;
/** Fewer different songs than this at an hour is too little to call a habit. */
const MIN_BAND_SONGS = 8;
const BAND_LOOKBACK_DAYS = 60;
const MIN_PLAYED_MS = 30_000;
const SHELF_SONGS = 20;

const LANGUAGE_NAMES: Record<string, string> = { hindi: 'Hindi', english: 'English' };
const languageName = (language: string): string =>
  LANGUAGE_NAMES[language] ?? language.charAt(0).toUpperCase() + language.slice(1);

const shelvesKey = (userId: number, band: HourBand) => `home:v1:${userId}:${band}`;
onInvalidate(async (userId) => {
  await Promise.all(
    (Object.keys(HOUR_BANDS) as HourBand[]).map((band) => cache.del(shelvesKey(userId, band)))
  );
});

const withReasons = (items: Array<{ songId: string; reason?: string }>) =>
  Object.fromEntries(items.flatMap((item) => (item.reason ? [[item.songId, item.reason]] : [])));

/** One Daily Mix: new songs like this side of their taste, with songs they know from it between. */
const buildMix = async (
  group: MixGroup,
  index: number,
  profile: ListenerProfile,
  now: Date
): Promise<Shelf | null> => {
  const seeds = pickSeeds(group.listens, now).slice(0, MIX_SEEDS);
  const fused = (await relatedTo(seeds, profile)).slice(0, 120);
  const [facts, moods] = await Promise.all([
    loadSongFacts(fused.map((item) => item.songId)),
    group.mood ? songMoods(fused.map((item) => item.songId)) : Promise.resolve(new Map()),
  ]);

  const perArtist = new Map<string, number>();
  const titles = new Set(group.listens.map((listen) => cleanTitle(listen.name)));
  const fresh = fused
    .filter((item) => facts.get(item.songId)?.language === group.language)
    .map((item) => {
      const mood = moods.get(item.songId);
      const fit =
        !group.mood || !mood ? 1 : mood === group.mood ? SAME_MOOD_BOOST : OTHER_MOOD_WEIGHT;
      return { ...item, score: item.score * fit };
    })
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const fact = facts.get(item.songId)!;
      const artist = normalize(fact.artist);
      const title = cleanTitle(fact.name);
      if ((perArtist.get(artist) ?? 0) >= MIX_NEW_PER_ARTIST || titles.has(title)) return false;
      perArtist.set(artist, (perArtist.get(artist) ?? 0) + 1);
      titles.add(title);
      return true;
    });
  const familiar = [...group.listens]
    .sort((a, b) => engagement(b) - engagement(a))
    .map((listen) => ({ songId: listen.songId }));

  const order = interleave(fresh, familiar, MIX_FAMILIAR_EVERY, MIX_SONGS);
  const songs = await loadSongData(order.map((item) => item.songId));
  if (songs.length < 6) return null;

  const mood = group.mood ? moodByKey(group.mood) : undefined;
  return {
    key: `mix-${index + 1}`,
    title: mood
      ? `${mood.title} ${languageName(group.language)} mix`
      : `${languageName(group.language)} mix`,
    subtitle: describeArtists(leadArtists(group.listens)),
    songs,
    reasons: withReasons(fresh),
  };
};

const dailyMixes = async (profile: ListenerProfile, now: Date): Promise<Shelf[]> => {
  const moods = await songMoods(profile.listens.map((listen) => listen.songId));
  const groups = mixGroups(
    profile.listens.map((listen) => ({ ...listen, mood: moods.get(listen.songId) ?? null })),
    now
  );
  const mixes: Shelf[] = [];
  // One at a time: each needs related songs, which may not be cached yet.
  for (const [index, group] of groups.entries()) {
    const mix = await buildMix(group, index, profile, now);
    if (mix) mixes.push(mix);
  }
  return mixes;
};

/** What this listener plays at this time of day, and new songs like it. */
const timeOfDay = async (
  profile: ListenerProfile,
  band: HourBand,
  tzOffsetMinutes: number
): Promise<Shelf | null> => {
  // An aggregate over play events by local hour: one statement, which a model can't express.
  const rows = await sequelize.query<{ songId: string; plays: string }>(
    `
    SELECT s."songId", COUNT(*) AS plays
    FROM play_events e
    JOIN songs s ON s.id = e."songRefId"
    WHERE e."userId" = :userId
      AND e."startedAt" > NOW() - make_interval(days => :days)
      AND e."playedMs" >= :minPlayed
      AND EXTRACT(HOUR FROM (e."startedAt" AT TIME ZONE 'UTC') - make_interval(mins => :offset))
        = ANY(ARRAY[:hours]::int[])
    GROUP BY 1
    ORDER BY plays DESC
    LIMIT 40
    `,
    {
      replacements: {
        userId: profile.userId,
        days: BAND_LOOKBACK_DAYS,
        minPlayed: MIN_PLAYED_MS,
        offset: tzOffsetMinutes,
        hours: HOUR_BANDS[band].hours,
      },
      type: QueryTypes.SELECT,
    }
  );
  const disliked = profile.dislikes.songIds;
  const habits = rows.filter((row) => !disliked.has(row.songId));
  if (habits.length < MIN_BAND_SONGS) return null;

  const top = Number(habits[0]!.plays);
  const seeds = habits.slice(0, MIX_SEEDS).map((row) => ({
    songId: row.songId,
    weight: Number(row.plays) / top,
  }));
  const fresh = (await relatedTo(seeds, profile)).slice(0, 14);
  const order = interleave(
    fresh,
    habits.map((row) => ({ songId: row.songId })),
    MIX_FAMILIAR_EVERY,
    SHELF_SONGS
  );
  return {
    key: `time-${band}`,
    title: HOUR_BANDS[band].title,
    subtitle: 'What you play around this time, and more like it',
    songs: await loadSongData(order.map((item) => item.songId)),
    reasons: withReasons(fresh),
  };
};

const rediscover = async (profile: ListenerProfile, now: Date): Promise<Shelf | null> => {
  const favourites = pickFavourites(profile.listens, now).slice(0, SHELF_SONGS);
  if (favourites.length < 4) return null;
  return {
    key: 'rediscover',
    title: 'Rediscover',
    subtitle: "Favourites you haven't played in a while",
    songs: await loadSongData(favourites.map((item) => item.songId)),
  };
};

/** Shelves built from listening, which change slowly and are kept for a few hours. */
const slowShelves = async (
  profile: ListenerProfile,
  band: HourBand,
  tzOffsetMinutes: number
): Promise<Shelf[]> => {
  const key = shelvesKey(profile.userId, band);
  const cached = await cache.get<Shelf[]>(key);
  if (cached) return cached;

  const now = new Date();
  const settle = async <T>(work: Promise<T>, fallback: T, name: string): Promise<T> => {
    try {
      return await work;
    } catch (err) {
      console.error(`[Shelves] ${name} failed for user ${profile.userId}:`, (err as Error).message);
      return fallback;
    }
  };
  const mixes = await settle(dailyMixes(profile, now), [], 'Daily mixes');
  const hour = await settle(timeOfDay(profile, band, tzOffsetMinutes), null, 'Time of day');
  const again = await settle(rediscover(profile, now), null, 'Rediscover');
  const shelves = [...mixes, hour, again].filter((shelf): shelf is Shelf => !!shelf);
  await cache.set(key, shelves, SHELF_CACHE_SECONDS);
  return shelves;
};

/**
 * The listener's own shelves for the home page, in order: Daily Mixes, this time of day, new
 * releases from their artists, favourites to rediscover, and their latest likes.
 */
export const getPersonalShelves = async (
  userId: number,
  options: { tzOffsetMinutes: number }
): Promise<Shelf[]> => {
  const profile = await loadProfile(userId);
  const localHour = new Date(Date.now() - options.tzOffsetMinutes * 60_000).getUTCHours();
  const band = hourBandOf(localHour);

  const [slow, releases, liked] = await Promise.all([
    profile.listens.length > 0 ? slowShelves(profile, band, options.tzOffsetMinutes) : [],
    newFromYourArtists(profile).catch((err) => {
      console.error('[Shelves] New releases failed:', (err as Error).message);
      return [];
    }),
    listLikedSongs(userId, SHELF_SONGS),
  ]);

  const [mixes, rest] = [
    slow.filter((shelf) => shelf.key.startsWith('mix-')),
    slow.filter((shelf) => !shelf.key.startsWith('mix-')),
  ];
  const timeShelf = rest.filter((shelf) => shelf.key.startsWith('time-'));
  const others = rest.filter((shelf) => !shelf.key.startsWith('time-'));
  return [
    ...mixes,
    ...timeShelf,
    ...(releases.length >= 3
      ? [{ key: 'new-releases', title: 'New from your artists', songs: releases }]
      : []),
    ...others,
    ...(liked.length > 0 ? [{ key: 'liked', title: 'Liked songs', songs: liked }] : []),
  ];
};
