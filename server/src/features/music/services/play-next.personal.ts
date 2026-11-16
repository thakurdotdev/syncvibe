/**
 * Pure rules that fit a song's shared play-next list to one listener. No database or cache
 * access lives here, so the rules can be unit tested.
 */
import { cleanTitle } from './play-next.scoring';

export interface PastListen {
  lastPlayedAt: Date;
  playedCount: number;
  skipCount: number;
}

export interface Candidate {
  songId: string;
  name: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Played this recently, a song is still fresh in mind and would only repeat. */
const RECENT_DAYS = 3;
/** One song the listener knows after every few new ones: enough to feel familiar, no more. */
const FAMILIAR_EVERY = 5;

/** A one-word title ("Baarish") is shared by too many unrelated songs to block them all. */
const isDistinctTitle = (title: string): boolean => title.split(' ').length >= 2;

/** Titles that block other versions of a disliked song: remixes, lofi, "From the film" copies. */
export const blockedTitlesOf = (dislikedNames: Iterable<string>): Set<string> => {
  const titles = new Set<string>();
  for (const name of dislikedNames) {
    const title = cleanTitle(name);
    if (title && isDistinctTitle(title)) titles.add(title);
  }
  return titles;
};

const isMostlySkipped = (listen: PastListen): boolean =>
  listen.skipCount > 0 && listen.skipCount >= listen.playedCount;

/**
 * The list for one listener, in the shared order where possible: songs they haven't heard
 * lead, with one they know but haven't played lately after every few. Disliked songs and
 * songs they keep skipping never appear. Songs played in the last few days only fill the end
 * when nothing else is left, so autoplay never runs dry.
 */
export const personalizePlayNext = ({
  candidates,
  history,
  dislikedIds,
  blockedTitles,
  now,
  limit,
}: {
  candidates: Candidate[];
  history: Map<string, PastListen>;
  dislikedIds: Set<string>;
  blockedTitles: Set<string>;
  now: Date;
  limit: number;
}): string[] => {
  const fresh: string[] = [];
  const familiar: string[] = [];
  const recent: Array<{ songId: string; lastPlayedAt: number }> = [];

  for (const { songId, name } of candidates) {
    if (dislikedIds.has(songId) || blockedTitles.has(cleanTitle(name))) continue;
    const listen = history.get(songId);
    if (!listen) {
      fresh.push(songId);
      continue;
    }
    if (isMostlySkipped(listen)) continue;
    const playedAt = new Date(listen.lastPlayedAt).getTime();
    if (now.getTime() - playedAt < RECENT_DAYS * DAY_MS) {
      recent.push({ songId, lastPlayedAt: playedAt });
    } else {
      familiar.push(songId);
    }
  }

  const result: string[] = [];
  while (result.length < limit && (fresh.length > 0 || familiar.length > 0)) {
    const familiarTurn = (result.length + 1) % FAMILIAR_EVERY === 0;
    const next =
      (familiarTurn ? familiar.shift() : fresh.shift()) ?? fresh.shift() ?? familiar.shift();
    result.push(next!);
  }
  // Longest ago first: the song from this morning is the last thing worth hearing again.
  recent.sort((a, b) => a.lastPlayedAt - b.lastPlayedAt);
  for (const { songId } of recent) {
    if (result.length >= limit) break;
    result.push(songId);
  }
  return result;
};

export type Steer = 'more' | 'different' | `mood:${string}`;

export interface SteerCandidate {
  songId: string;
  singer: string;
  album: string;
  mood: string | null;
}

/**
 * Reorders the next songs by what the listener did this session and asked for. Two quick skips of
 * an artist push the rest of that artist to the end; artists played to the end move up a little.
 * "more" brings the playing song's singers and album forward, "different" moves them back, and a
 * mood brings songs of that mood forward. Nothing is dropped, so autoplay never runs dry.
 */
export const steerPlayNext = ({
  candidates,
  baseSingers,
  baseAlbum,
  skippedArtists,
  finishedArtists,
  steer,
}: {
  candidates: SteerCandidate[];
  baseSingers: Set<string>;
  baseAlbum: string;
  /** Normalised artist name to how many of their songs were skipped quickly this session. */
  skippedArtists: Map<string, number>;
  finishedArtists: Set<string>;
  steer?: Steer | null;
}): string[] => {
  const steerMood = steer?.startsWith('mood:') ? steer.slice('mood:'.length) : null;
  const score = (candidate: SteerCandidate, index: number): number => {
    const isBase =
      baseSingers.has(candidate.singer) || (!!baseAlbum && candidate.album === baseAlbum);
    let value = -index;
    if ((skippedArtists.get(candidate.singer) ?? 0) >= 2) value -= 1000;
    else if (finishedArtists.has(candidate.singer)) value += 3;
    if (steer === 'more' && isBase) value += 500;
    if (steer === 'different' && isBase) value -= 500;
    if (steerMood && candidate.mood === steerMood) value += 500;
    return value;
  };
  return candidates
    .map((candidate, index) => ({ songId: candidate.songId, value: score(candidate, index) }))
    .sort((a, b) => b.value - a.value)
    .map((item) => item.songId);
};
