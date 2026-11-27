import type { LyricLine } from '@/models/music/song-lyrics.model';

/*
 * Rules for finding a song's lyrics: reading LRC files, and deciding whether a lyrics entry is
 * this song. A wrong song's lyrics are worse than none, so a match must agree on the title, the
 * length and (unless the album agrees) a singer.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

/** Saavn's names come HTML-encoded ("Ae Dil Hai Mushkil (From &quot;…&quot;)"). */
export const decodeEntities = (value: string): string =>
  value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });

/**
 * A title as the lyrics site would have it: no "(From "Film")", "[Remix]", "- From …" or
 * "feat. …", which Saavn adds and lyrics sites mostly don't.
 */
export const cleanTitle = (title: string): string =>
  decodeEntities(title)
    .replace(/\s*[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\s+-\s+(from|feat\.?|ft\.?)\s.*$/i, '')
    .replace(/\s+(feat\.?|ft\.?)\s.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Lower case, no accents or punctuation; letters of every script are kept. */
export const normalize = (value: string): string =>
  decodeEntities(value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const tokens = (value: string) => new Set(normalize(value).split(' ').filter(Boolean));

/** 1 for the same title, less the more the words differ. */
export const titleSimilarity = (a: string, b: string): number => {
  const x = normalize(cleanTitle(a));
  const y = normalize(cleanTitle(b));
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.replace(/ /g, '') === y.replace(/ /g, '')) return 1;
  const tx = tokens(x);
  const ty = tokens(y);
  let shared = 0;
  for (const t of tx) if (ty.has(t)) shared += 1;
  return shared / (tx.size + ty.size - shared);
};

/** "A, B & C feat. D" → ["a", "b", "c", "d"]. */
export const splitArtists = (value: string): string[] =>
  decodeEntities(value)
    .split(/\s*(?:,|&|\/|;|•|\+|\bfeat\.?|\bft\.?|\band\b|\bx\b)\s*/i)
    .map(normalize)
    .filter(Boolean);

/** Whether any of our singers is among the entry's artists. */
export const artistsOverlap = (ours: string[], theirs: string): boolean => {
  const them = splitArtists(theirs);
  const joined = normalize(theirs);
  return ours
    .map(normalize)
    .filter(Boolean)
    .some(
      (name) =>
        them.includes(name) ||
        // Names written together ("Vishal-Shekhar/Sunidhi Chauhan") or with extra words.
        (name.length >= 4 && ` ${joined} `.includes(` ${name} `))
    );
};

/** What we know about the song we're matching. */
export interface SongFacts {
  title: string;
  /** Saavn's language ("hindi"); '' when unknown. */
  language?: string;
  /** Singers first; never lyricists or actors, who say nothing about a recording. */
  artists: string[];
  album: string | null;
  /** Seconds. 0 when unknown. */
  duration: number;
}

/** One entry from LRCLIB. */
export interface LyricsEntry {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

type Script =
  | 'latin'
  | 'devanagari'
  | 'gurmukhi'
  | 'gujarati'
  | 'bengali'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam'
  | 'odia'
  | 'arabic';

const SCRIPT_RANGES: Array<[Script, RegExp]> = [
  ['latin', /\p{Script=Latin}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
  ['gurmukhi', /\p{Script=Gurmukhi}/u],
  ['gujarati', /\p{Script=Gujarati}/u],
  ['bengali', /\p{Script=Bengali}/u],
  ['tamil', /\p{Script=Tamil}/u],
  ['telugu', /\p{Script=Telugu}/u],
  ['kannada', /\p{Script=Kannada}/u],
  ['malayalam', /\p{Script=Malayalam}/u],
  ['odia', /\p{Script=Oriya}/u],
  ['arabic', /\p{Script=Arabic}/u],
];

/** How many letters of each script a text has. */
const scriptCounts = (text: string): { counts: Map<Script, number>; letters: number } => {
  const counts = new Map<Script, number>();
  let letters = 0;
  for (const char of text) {
    for (const [script, pattern] of SCRIPT_RANGES) {
      if (pattern.test(char)) {
        counts.set(script, (counts.get(script) ?? 0) + 1);
        letters += 1;
        break;
      }
    }
  }
  return { counts, letters };
};

/** The script most of the letters are in, or null for text with hardly any letters. */
export const mainScript = (text: string): Script | null => {
  const { counts, letters } = scriptCounts(text);
  if (letters < 20) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/**
 * Scripts a song in this language is written in. Latin is always fine (romanised lyrics are
 * common); another language's script means the entry is a dub, such as a Tamil "Pushpa Pushpa"
 * for the Hindi one, which has the same length and composer.
 */
const LANGUAGE_SCRIPTS: Record<string, Script[]> = {
  hindi: ['devanagari', 'arabic'],
  bhojpuri: ['devanagari'],
  haryanvi: ['devanagari'],
  rajasthani: ['devanagari'],
  marathi: ['devanagari'],
  sanskrit: ['devanagari'],
  punjabi: ['gurmukhi', 'devanagari', 'arabic'],
  urdu: ['arabic', 'devanagari'],
  gujarati: ['gujarati', 'devanagari'],
  bengali: ['bengali'],
  tamil: ['tamil'],
  telugu: ['telugu'],
  kannada: ['kannada'],
  malayalam: ['malayalam'],
  odia: ['odia'],
  english: [],
};

/**
 * A share of the letters in the language's own script that makes a text this song even when
 * another script has more: Hindi film songs often have Punjabi verses written in Gurmukhi.
 * A dub has next to none.
 */
const MIN_OWN_SCRIPT_SHARE = 0.2;

export const scriptFits = (language: string | undefined, text: string): boolean => {
  const allowed = language ? LANGUAGE_SCRIPTS[language.toLowerCase()] : undefined;
  if (!allowed) return true;
  const script = mainScript(text);
  if (script === null || script === 'latin' || allowed.includes(script)) return true;
  const { counts, letters } = scriptCounts(text);
  const own = allowed.reduce((sum, s) => sum + (counts.get(s) ?? 0), 0);
  return own / letters >= MIN_OWN_SCRIPT_SHARE;
};

/** Lengths further apart than this are another recording (a remix, a live take, a cover). */
export const MAX_DURATION_GAP_S = 4;
const MIN_TITLE_SIMILARITY = 0.6;

/** How well an entry matches the song, or null when it isn't this song. Higher is better. */
export const matchScore = (song: SongFacts, entry: LyricsEntry): number | null => {
  if (entry.instrumental) return null;
  if (!entry.syncedLyrics && !entry.plainLyrics) return null;
  if (!scriptFits(song.language, entry.syncedLyrics || entry.plainLyrics || '')) return null;

  const title = titleSimilarity(song.title, entry.trackName);
  if (title < MIN_TITLE_SIMILARITY) return null;

  const gap = song.duration > 0 && entry.duration ? Math.abs(song.duration - entry.duration) : null;
  if (gap !== null && gap > MAX_DURATION_GAP_S) return null;

  const artist = artistsOverlap(song.artists, entry.artistName);
  const album =
    Boolean(song.album && entry.albumName) &&
    titleSimilarity(song.album as string, entry.albumName as string) >= 0.8;
  // Same title and length but nobody in common is usually another song of that name.
  if (!artist && !(album && title === 1 && gap !== null && gap <= 2)) return null;

  let score = title * 50;
  if (artist) score += 25;
  if (album) score += 10;
  if (gap !== null) score += gap <= 1 ? 15 : gap <= 2 ? 10 : 3;
  // Every entry left is this song; timings that follow it are what we're here for, so they
  // outweigh a matching album or a closer length.
  if (lyricsOf(entry, song.duration)?.kind === 'synced') score += 30;
  return score;
};

/** The best entry that is this song and wasn't reported wrong, or null. */
export const pickEntry = (
  song: SongFacts,
  entries: LyricsEntry[],
  rejected: ReadonlySet<string> = new Set()
): LyricsEntry | null => {
  let best: LyricsEntry | null = null;
  let bestScore = -1;
  for (const entry of entries) {
    if (rejected.has(String(entry.id))) continue;
    const score = matchScore(song, entry);
    if (score !== null && score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
};

/** Lines closer than this are noise; half a minute apart, each "line" is a verse. */
const MIN_MEDIAN_GAP_S = 0.5;
const MAX_MEDIAN_GAP_S = 15;
/** Longer than this on average, a "line" is a verse. */
const MAX_LINE_CHARS = 70;
/** Timed lines run across most of a song; made-up ones bunch at the start. */
const MIN_SPAN_SHARE = 0.4;

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const hasTimestamps = (text: string | null | undefined) =>
  Boolean(text && /\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/.test(text));

const tagMs = (min: string, sec: string, frac?: string) => {
  const fraction = frac ? Number(frac.padEnd(3, '0').slice(0, 3)) : 0;
  return (Number(min) * 60 + Number(sec)) * 1000 + fraction;
};

/**
 * LRC to lines in time order. A line may carry several time tags (a repeated chorus); `[offset:]`
 * is applied; word timings (`<00:12.34>`) and metadata are dropped. Returns null when the text
 * has too few timed lines to follow.
 */
export const parseLrc = (lrc: string | null | undefined): LyricLine[] | null => {
  if (!lrc) return null;
  const offsetMatch = /\[offset:\s*([+-]?\d+)\s*\]/i.exec(lrc);
  // A positive offset means the lyrics come sooner.
  const offset = offsetMatch ? -Number(offsetMatch[1]) : 0;
  const lines: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(TIME_TAG)];
    if (stamps.length === 0) continue;
    const text = raw
      .replace(TIME_TAG, '')
      .replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    for (const [, min, sec, frac] of stamps) {
      lines.push({ t: Math.max(0, tagMs(min ?? '0', sec ?? '0', frac) + offset), text });
    }
  }
  lines.sort((a, b) => a.t - b.t);
  // Blank lines are kept as pauses, but not several in a row or at the very start.
  const tidy: LyricLine[] = [];
  for (const line of lines) {
    const last = tidy[tidy.length - 1];
    if (!line.text && (!last || !last.text)) continue;
    tidy.push(line);
  }
  while (tidy.length && !tidy[tidy.length - 1]?.text) tidy.pop();
  return tidy.filter((l) => l.text).length >= 4 ? tidy : null;
};

/** Plain lyrics as text: Saavn's `<br>`s become new lines, stray time tags go. */
export const cleanPlain = (text: string | null | undefined): string | null => {
  if (!text) return null;
  const clean = decodeEntities(text.replace(/<br\s*\/?>/gi, '\n'))
    .replace(TIME_TAG, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return clean.length >= 20 ? clean : null;
};

export type ResolvedLyrics =
  | { kind: 'synced'; lines: LyricLine[]; plain: string | null }
  | { kind: 'plain'; plain: string };

/**
 * Whether a timed entry's timings follow the singing. Some entries are timed by hand without
 * listening: a line a second from 0:00 (over in a fraction of the song), or a whole verse per
 * time. Lines out of step are worse than lines that aren't timed. `durationS`: 0 when unknown.
 */
export const timingLooksReal = (lines: LyricLine[], durationS: number): boolean => {
  const sung = lines.filter((l) => l.text);
  if (sung.length < 4) return false;
  const gaps = sung
    .slice(1)
    .map((l, i) => (l.t - (sung[i] as LyricLine).t) / 1000)
    .sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] ?? 0;
  if (median < MIN_MEDIAN_GAP_S || median > MAX_MEDIAN_GAP_S) return false;
  const chars = sung.reduce((sum, l) => sum + l.text.length, 0) / sung.length;
  if (chars > MAX_LINE_CHARS) return false;
  if (durationS > 0) {
    const span = ((sung[sung.length - 1] as LyricLine).t - (sung[0] as LyricLine).t) / 1000;
    if (span < durationS * MIN_SPAN_SHARE) return false;
  }
  return true;
};

/** An entry's lyrics, timed when it can be: some entries keep timings in their plain text. */
export const lyricsOf = (entry: LyricsEntry, durationS = 0): ResolvedLyrics | null => {
  const lines = parseLrc(entry.syncedLyrics) ?? parseLrc(entry.plainLyrics);
  const plain = hasTimestamps(entry.plainLyrics) ? null : cleanPlain(entry.plainLyrics);
  if (lines && timingLooksReal(lines, durationS)) return { kind: 'synced', lines, plain };
  if (plain) return { kind: 'plain', plain };
  // Timings that don't follow the song still carry the words.
  if (lines) return { kind: 'plain', plain: lines.map((l) => l.text).join('\n') };
  return null;
};

interface SongArtist {
  name?: string;
  role?: string;
}

/**
 * Who sings a song, from Saavn's data: singers first, then the primary artists. Lyricists, music
 * directors and actors are left out unless nobody else is credited.
 */
export const singersOf = (songData: Record<string, unknown>): string[] => {
  const map = (songData.artist_map ?? {}) as Record<string, unknown>;
  const all = [
    ...((map.artists as SongArtist[]) ?? []),
    ...((map.primary_artists as SongArtist[]) ?? []),
  ].filter((a) => a && typeof a.name === 'string');
  const role = (a: SongArtist) => (a.role || '').toLowerCase();
  const singers = all.filter((a) => role(a).includes('singer'));
  const primary = ((map.primary_artists as SongArtist[]) ?? []).filter((a) => a?.name);
  const rest = all.filter((a) => !/lyricist|starring|actor/.test(role(a)));
  const picked = singers.length ? [...singers, ...primary] : rest.length ? rest : all;
  return [...new Set(picked.map((a) => decodeEntities(a.name as string).trim()))].filter(Boolean);
};

/** What we match on, from a song as the song API gives it. */
export const factsOf = (songData: Record<string, unknown>): SongFacts => {
  const album = songData.album as unknown;
  const albumName =
    typeof album === 'string'
      ? album
      : typeof (album as { name?: unknown })?.name === 'string'
        ? (album as { name: string }).name
        : typeof songData.album_name === 'string'
          ? songData.album_name
          : null;
  return {
    title: decodeEntities(String(songData.name ?? songData.title ?? '')),
    language: typeof songData.language === 'string' ? songData.language : '',
    artists: singersOf(songData),
    album: albumName ? decodeEntities(albumName) : null,
    duration: Number(songData.duration) || 0,
  };
};
