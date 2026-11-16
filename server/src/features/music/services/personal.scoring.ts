/**
 * Pure rules for the personal shelves: Daily Mixes, the time-of-day shelf and Blend. No database
 * or cache access lives here, so the rules can be unit tested.
 */
import { normalize } from './play-next.scoring';
import { engagement, type Listen } from './recommendation.scoring';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENCY_HALF_LIFE_DAYS = 30;
/** Fewer songs than this is a passing phase, not a side of someone's taste. */
const MIN_SONGS_PER_MIX = 5;
const MAX_MIXES = 4;

export interface MoodListen extends Listen {
  mood?: string | null;
}

export interface MixGroup {
  key: string;
  language: string;
  mood: string | null;
  listens: MoodListen[];
  weight: number;
}

const recencyWeight = (listen: Listen, now: Date): number =>
  engagement(listen) *
  0.5 **
    (Math.max(now.getTime() - new Date(listen.lastPlayedAt).getTime(), 0) /
      DAY_MS /
      RECENCY_HALF_LIFE_DAYS);

const groupBy = (listens: MoodListen[], keyOf: (listen: MoodListen) => string) => {
  const groups = new Map<string, MoodListen[]>();
  for (const listen of listens) {
    const key = keyOf(listen);
    groups.set(key, [...(groups.get(key) ?? []), listen]);
  }
  return groups;
};

/**
 * The sides of someone's taste, one mix each: a language and a mood ("Romantic Hindi"), strongest
 * first. Mixing them in one list is what put a party song after a heartbreak song. Without enough
 * mood-labelled songs it falls back to one mix per language.
 */
export const mixGroups = (listens: MoodListen[], now: Date): MixGroup[] => {
  const usable = listens.filter((listen) => listen.language && recencyWeight(listen, now) > 0);
  const build = (keyOf: (listen: MoodListen) => string, withMood: boolean): MixGroup[] =>
    [...groupBy(usable, keyOf).entries()]
      .map(([key, members]) => ({
        key,
        language: members[0]!.language!,
        mood: withMood ? (members[0]!.mood ?? null) : null,
        listens: members,
        weight: members.reduce((sum, listen) => sum + recencyWeight(listen, now), 0),
      }))
      .filter((group) => group.listens.length >= MIN_SONGS_PER_MIX)
      .sort((a, b) => b.weight - a.weight);

  const byMood = build((listen) => `${listen.language}:${listen.mood ?? 'any'}`, true).filter(
    (group) => group.mood
  );
  if (byMood.length >= 2) return byMood.slice(0, MAX_MIXES);
  return build((listen) => `${listen.language}:any`, false).slice(0, MAX_MIXES);
};

/** The artists a mix leans on most, to name it: "Arijit Singh, Shreya Ghoshal and more". */
export const leadArtists = (listens: Listen[], count = 2): string[] => {
  const weights = new Map<string, { name: string; weight: number }>();
  for (const listen of listens) {
    const key = normalize(listen.artist);
    if (!key) continue;
    const entry = weights.get(key) ?? { name: listen.artist, weight: 0 };
    entry.weight += engagement(listen);
    weights.set(key, entry);
  }
  return [...weights.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
    .map((entry) => entry.name);
};

export const describeArtists = (artists: string[]): string | undefined =>
  artists.length === 0 ? undefined : `${artists.join(', ')} and more`;

/** New songs lead; one the listener knows follows every `every` new ones. */
export const interleave = <T>(fresh: T[], familiar: T[], every: number, limit: number): T[] => {
  const result: T[] = [];
  const known = [...familiar];
  fresh.forEach((item, index) => {
    result.push(item);
    if ((index + 1) % every === 0 && known.length > 0) result.push(known.shift()!);
  });
  return [...result, ...known].slice(0, limit);
};

export type HourBand = 'morning' | 'afternoon' | 'evening' | 'night';

export const HOUR_BANDS: Record<HourBand, { title: string; hours: number[] }> = {
  morning: { title: 'Your mornings', hours: [5, 6, 7, 8, 9, 10, 11] },
  afternoon: { title: 'Your afternoons', hours: [12, 13, 14, 15, 16] },
  evening: { title: 'Your evenings', hours: [17, 18, 19, 20, 21] },
  night: { title: 'Your late nights', hours: [22, 23, 0, 1, 2, 3, 4] },
};

export const hourBandOf = (hour: number): HourBand =>
  (Object.keys(HOUR_BANDS) as HourBand[]).find((band) =>
    HOUR_BANDS[band].hours.includes(((hour % 24) + 24) % 24)
  ) ?? 'night';

export type BlendSide = 'you' | 'them' | 'both';

/**
 * A mix of two people's taste: songs they both play lead, then each side's picks in turn, so
 * neither person's taste takes over.
 */
export const composeBlend = <T extends { songId: string }>(
  shared: T[],
  mine: T[],
  theirs: T[],
  limit: number
): Array<T & { side: BlendSide }> => {
  const used = new Set<string>();
  const result: Array<T & { side: BlendSide }> = [];
  const add = (item: T | undefined, side: BlendSide) => {
    if (!item || used.has(item.songId) || result.length >= limit) return;
    used.add(item.songId);
    result.push({ ...item, side });
  };
  shared.slice(0, Math.ceil(limit / 5)).forEach((item) => add(item, 'both'));
  for (let i = 0; i < Math.max(mine.length, theirs.length); i++) {
    add(mine[i], 'you');
    add(theirs[i], 'them');
  }
  return result;
};

export const WEEK_DAYS = 7;

/** Midnight at the start of the 7th local day back, as a UTC instant: "this week" for a recap. */
export const weekStartOf = (now: number, tzOffsetMinutes: number): Date => {
  const localNow = now - tzOffsetMinutes * 60_000;
  const localMidnight = localNow - (((localNow % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(localMidnight - (WEEK_DAYS - 1) * DAY_MS + tzOffsetMinutes * 60_000);
};
