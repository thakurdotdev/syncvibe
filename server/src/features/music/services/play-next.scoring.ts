/**
 * Pure ranking rules for play-next. No database or cache access lives here, so the rules can
 * be unit tested and changed without touching how candidates are fetched.
 */

export interface SongEntry {
  id: number;
  songId: string;
  name: string;
  singers: string[];
  musicDirectors: string[];
  lyricists: string[];
  albumName: string;
  albumId: string;
  language: string;
  duration: number;
  playCount: number;
  year: number;
  isVariant: boolean;
}

export interface ScoredItem {
  songId: string;
  score: number;
  name: string;
  topSinger: string;
}

const VARIANT_TAGS = [
  'remix',
  'dubstep',
  'edm',
  'lofi',
  'lo-fi',
  'slowed',
  'sped up',
  'reverb',
  '8d',
  'mashup',
  'smashup',
  'mix',
  'flip',
  'nightcore',
  'bass boosted',
  'phonk',
  'trap',
  'instrumental',
  'karaoke',
  'cover',
  'recreated',
  'unplugged',
  'acoustic',
  'reprise',
  'jhankar',
  'jhankar beats',
];

/** A few shared listeners say little about taste, so co-listening can only nudge the score. */
const CO_LISTEN_POINTS_PER_WEIGHT = 2.5;
const MAX_CO_LISTEN_POINTS = 15;
const MAX_SONGS_PER_SINGER = 4;
/** Longer than this is usually film dialogue or a long recital, not a next song. */
const LONG_TRACK_SECONDS = 600;
const SHORT_TRACK_SECONDS = 60;

export const normalize = (str: string | undefined | null): string =>
  (str || '').toLowerCase().trim();

export const cleanTitle = (name: string): string => {
  return normalize(name)
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(
      /\s*-\s*(from|feat|ft|remix|unplugged|reprise|acoustic|lofi|slowed|reverb|version|male|female|duet|sad|happy|jhankar|remastered|deluxe).*$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
};

export const hasVariantTag = (name: string): boolean => {
  const lower = normalize(name);
  return VARIANT_TAGS.some((tag) => {
    const pattern = new RegExp(`\\b${tag}\\b|[\\(\\[]\\s*${tag}`, 'i');
    return pattern.test(lower);
  });
};

export const dedupKey = (name: string, artist: string): string =>
  `${cleanTitle(name)}::${normalize(artist)}`;

const containsTitle = (title: string, inner: string): boolean => {
  // One word ("Baarish") is too common a title to prove two songs are the same song.
  if (inner.split(' ').length < 2) return false;
  const escaped = inner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(title);
};

/** True for another copy, cover, remix or mashup of the song that is already playing. */
export const isVersionOfSeed = (candidateName: string, seedName: string): boolean => {
  const candidate = cleanTitle(candidateName);
  const seed = cleanTitle(seedName);
  if (!candidate || !seed) return false;
  return candidate === seed || containsTitle(candidate, seed) || containsTitle(seed, candidate);
};

/** Long tracks only follow long tracks, so a recital can follow a recital but not a film song. */
export const hasPlausibleLength = (candidate: SongEntry, seed: SongEntry): boolean => {
  if (candidate.duration <= 0) return true;
  if (candidate.duration > LONG_TRACK_SECONDS && seed.duration <= LONG_TRACK_SECONDS) return false;
  if (candidate.duration < SHORT_TRACK_SECONDS && seed.duration >= SHORT_TRACK_SECONDS) return false;
  return true;
};

const normalizePlayCount = (playCount: number): number => {
  if (!playCount || playCount <= 0) return 0;
  return Math.min(Math.log10(playCount) / 9, 1);
};

export const scoreSong = (candidate: SongEntry, baseSong: SongEntry, coWeight = 0): number => {
  let score = 0;
  if (coWeight > 0) {
    score += Math.min(coWeight * CO_LISTEN_POINTS_PER_WEIGHT, MAX_CO_LISTEN_POINTS);
  }
  if (candidate.albumId && candidate.albumId === baseSong.albumId) score += 55;
  else if (candidate.albumName && candidate.albumName === baseSong.albumName) score += 50;

  const sharedSingers = candidate.singers.filter((s) => baseSong.singers.includes(s));
  score += Math.min(sharedSingers.length, 3) * 35;

  const sharedMDs = candidate.musicDirectors.filter((m) => baseSong.musicDirectors.includes(m));
  score += Math.min(sharedMDs.length, 2) * 20;

  const sharedLyricists = candidate.lyricists.filter((l) => baseSong.lyricists.includes(l));
  if (sharedLyricists.length > 0) score += 10;

  if (candidate.language && candidate.language === baseSong.language) score += 20;
  else if (candidate.language && baseSong.language && candidate.language !== baseSong.language)
    score -= 50;

  if (candidate.year > 0 && baseSong.year > 0) {
    const yearDiff = Math.abs(candidate.year - baseSong.year);
    if (yearDiff === 0) score += 10;
    else if (yearDiff <= 3) score += 7;
    else if (yearDiff <= 5) score += 4;
    else if (yearDiff > 12) score -= 15;
  }

  if (baseSong.isVariant !== candidate.isVariant) score -= 35;
  score += normalizePlayCount(candidate.playCount) * 5;

  return score;
};

/**
 * Best score first, with a cap per singer and the same singer kept apart where possible.
 * Spacing only moves a song back when a different singer is next in line, so strong matches
 * stay near the top instead of being outranked by every other singer's best song.
 */
export const rankWithDiversity = (scored: ScoredItem[], limit: number): string[] => {
  const seenTitles = new Set<string>();
  const songsPerSinger = new Map<string, number>();
  const pool: ScoredItem[] = [];

  for (const item of [...scored].sort((a, b) => b.score - a.score)) {
    const title = cleanTitle(item.name);
    if (seenTitles.has(title)) continue;
    seenTitles.add(title);

    const singer = item.topSinger || 'unknown';
    const count = songsPerSinger.get(singer) ?? 0;
    if (count >= MAX_SONGS_PER_SINGER) continue;
    songsPerSinger.set(singer, count + 1);
    pool.push(item);
  }

  const result: string[] = [];
  let lastSinger: string | null = null;
  while (pool.length > 0 && result.length < limit) {
    const differentSinger = pool.findIndex((item) => item.topSinger !== lastSinger);
    const [next] = pool.splice(Math.max(differentSinger, 0), 1);
    result.push(next!.songId);
    lastSinger = next!.topSinger;
  }
  return result;
};
