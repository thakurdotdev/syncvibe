/**
 * Pure rules for "Made for you". No database or cache access lives here, so the rules can be
 * unit tested and changed without touching how songs are fetched.
 */
import { cleanTitle, normalize } from './play-next.scoring';

export interface Listen {
  songId: string;
  name: string;
  artist: string;
  playedCount: number;
  /** Percent of the last play. 0 on rows from older clients, which never reported it. */
  completionRate: number;
  skipCount: number;
  lastPlayedAt: Date;
}

export interface Seed {
  songId: string;
  weight: number;
}

export interface Pick<T = unknown> {
  songId: string;
  name: string;
  artist: string;
  /** 0 to 1 within its kind. */
  score: number;
  kind: 'new' | 'favourite';
  song: T;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Taste drifts, so a play counts half as much after this long. */
const RECENCY_HALF_LIFE_DAYS = 30;
const MAX_SEEDS = 12;
/** One binge on a single artist shouldn't decide the whole list. */
const MAX_SEEDS_PER_ARTIST = 2;
const RELATED_PER_SEED = 40;
/** Flattens rank so a song related to several seeds beats the top match of one. */
const RANK_SMOOTHING = 15;
const FAVOURITE_MIN_PLAYS = 3;
/** A favourite played more recently than this is still in rotation and needs no reminder. */
const FAVOURITE_REST_DAYS = 14;
const FAVOURITE_SHARE = 0.25;
const MAX_PER_ARTIST = 2;
/** How far the day's draw can move a song: enough to rotate the list, not to bury the best. */
const DAILY_SPREAD = 0.8;

const daysSince = (date: Date, now: Date): number =>
  Math.max(now.getTime() - new Date(date).getTime(), 0) / DAY_MS;

/** How much the listener likes a song, from how they played it and regardless of when. */
export const engagement = (listen: Listen): number => {
  const plays = Math.log2(1 + Math.max(listen.playedCount, 1));
  const completion = listen.completionRate > 0 ? 0.5 + listen.completionRate / 100 : 1;
  const skipShare = Math.min(listen.skipCount / Math.max(listen.playedCount, 1), 1);
  return plays * completion * (1 - 0.8 * skipShare);
};

const isMostlySkipped = (listen: Listen): boolean =>
  listen.skipCount > 0 && listen.skipCount >= listen.playedCount;

/** The songs that best describe current taste: liked, recent, and from different artists. */
export const pickSeeds = (listens: Listen[], now: Date): Seed[] => {
  const ranked = listens
    .filter((listen) => !isMostlySkipped(listen))
    .map((listen) => ({
      listen,
      weight:
        engagement(listen) * 0.5 ** (daysSince(listen.lastPlayedAt, now) / RECENCY_HALF_LIFE_DAYS),
    }))
    .sort((a, b) => b.weight - a.weight);

  const perArtist = new Map<string, number>();
  const seeds: Seed[] = [];
  for (const { listen, weight } of ranked) {
    if (seeds.length >= MAX_SEEDS) break;
    const artist = normalize(listen.artist);
    const count = perArtist.get(artist) ?? 0;
    if (count >= MAX_SEEDS_PER_ARTIST) continue;
    perArtist.set(artist, count + 1);
    seeds.push({ songId: listen.songId, weight });
  }

  const top = seeds[0]?.weight ?? 0;
  return top > 0 ? seeds.map((seed) => ({ ...seed, weight: seed.weight / top })) : [];
};

/**
 * Joins each seed's related songs into one ranking of songs the listener hasn't played.
 * A song gains from every seed it is related to, more from stronger seeds and higher ranks.
 */
export const fuseRelated = (
  seeds: Seed[],
  relatedBySeed: Map<string, string[]>,
  heard: Set<string>
): Array<{ songId: string; score: number }> => {
  const scores = new Map<string, number>();
  for (const seed of seeds) {
    const related = (relatedBySeed.get(seed.songId) ?? []).slice(0, RELATED_PER_SEED);
    related.forEach((songId, rank) => {
      if (heard.has(songId)) return;
      scores.set(songId, (scores.get(songId) ?? 0) + seed.weight / (RANK_SMOOTHING + rank));
    });
  }
  return [...scores.entries()]
    .map(([songId, score]) => ({ songId, score }))
    .sort((a, b) => b.score - a.score);
};

/** Well-liked songs the listener hasn't played for a while, best first. */
export const pickFavourites = (
  listens: Listen[],
  now: Date
): Array<{ songId: string; score: number }> =>
  listens
    .filter(
      (listen) =>
        listen.playedCount >= FAVOURITE_MIN_PLAYS &&
        !isMostlySkipped(listen) &&
        daysSince(listen.lastPlayedAt, now) >= FAVOURITE_REST_DAYS
    )
    .map((listen) => ({ songId: listen.songId, score: engagement(listen) }))
    .sort((a, b) => b.score - a.score);

/** Drops other versions of a song already heard or already in the list. */
export const dropKnownTitles = <T extends { name: string }>(
  songs: T[],
  heardNames: Iterable<string>
): T[] => {
  const seen = new Set<string>();
  for (const name of heardNames) seen.add(cleanTitle(name));
  return songs.filter((song) => {
    const title = cleanTitle(song.name);
    if (!title || seen.has(title)) return false;
    seen.add(title);
    return true;
  });
};

export const toUnitScores = <T extends { score: number }>(items: T[]): T[] => {
  const top = Math.max(...items.map((item) => item.score), 0);
  return top > 0 ? items.map((item) => ({ ...item, score: item.score / top })) : items;
};

// FNV-1a: a stable number in [0, 1) for a string.
const unitHash = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x100000000;
};

/**
 * The list for one listener on one day. The draw depends only on `drawKey`, so the list stays
 * the same all day and changes the next, with stronger songs showing up more often.
 */
export const pickForDay = <T>(pool: Pick<T>[], limit: number, drawKey: string): Pick<T>[] => {
  const drawn = pool
    .map((pick) => ({
      pick,
      value:
        pick.score * (1 - DAILY_SPREAD / 2 + DAILY_SPREAD * unitHash(`${drawKey}:${pick.songId}`)),
    }))
    .sort((a, b) => b.value - a.value)
    .map(({ pick }) => pick);

  const perArtist = new Map<string, number>();
  const take = (kind: Pick['kind'], count: number): Pick<T>[] => {
    const taken: Pick<T>[] = [];
    for (const pick of drawn) {
      if (taken.length >= count) break;
      if (pick.kind !== kind) continue;
      const artist = normalize(pick.artist);
      const used = perArtist.get(artist) ?? 0;
      if (used >= MAX_PER_ARTIST) continue;
      perArtist.set(artist, used + 1);
      taken.push(pick);
    }
    return taken;
  };

  const favourites = take('favourite', Math.floor(limit * FAVOURITE_SHARE));
  const fresh = take('new', limit - favourites.length);
  // Too few new songs (a short history): more favourites are better than an empty row.
  if (fresh.length + favourites.length < limit) {
    const chosen = new Set(favourites);
    const rest = drawn.filter((pick) => pick.kind === 'favourite' && !chosen.has(pick));
    favourites.push(...rest.slice(0, limit - fresh.length - favourites.length));
  }

  // New songs lead; a favourite follows every third one.
  const result: Pick<T>[] = [];
  const queue = [...favourites];
  fresh.forEach((pick, index) => {
    result.push(pick);
    if (index % 3 === 2 && queue.length > 0) result.push(queue.shift()!);
  });
  return [...result, ...queue].slice(0, limit);
};
