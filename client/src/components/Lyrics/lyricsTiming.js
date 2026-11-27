/*
 * Where a song is in its lyrics. Kept alike with app/components/music/lyrics/lyricsTiming.ts.
 *
 * Lyrics are timed by line only, so a word's time is an estimate: the line's time shared out by
 * word length, sung over most of the gap to the next line (singers leave a breath at the end).
 * Words light softly, so an estimate a little off the beat still reads as following the singer.
 */

/** A line (or word) lights up this much before its time: it reads as on the beat, not late. */
export const LEAD_MS = 250;
/** Share of the gap to the next line the words are sung over. */
const SUNG_SHARE = 0.85;
/** A long gap is mostly a held note or a pause, not slower singing. */
const MAX_SUNG_MS = 5500;
/** A gap before the first line shorter than this isn't worth showing as a break. */
export const INTRO_MIN_MS = 3000;

/** The last line whose time has come, by binary search; -1 before the first. */
export const lineAt = (lines, ms) => {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((lines[mid]?.t ?? Infinity) <= ms) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
};

/** A line's words, with the space after each kept on it (scripts without spaces are one word). */
export const wordsOf = (text) => text.trim().match(/\S+\s*/g) ?? [];

/** When the line after `index` starts; the song's end (or a while later) for the last one. */
const endOf = (lines, index, durationMs) =>
  lines[index + 1]?.t ?? Math.max(durationMs, (lines[index]?.t ?? 0) + MAX_SUNG_MS);

/** How many of line `index`'s words have been sung at `ms`. */
export const wordsLit = (lines, index, ms, durationMs) => {
  const line = lines[index];
  if (!line) return 0;
  const words = wordsOf(line.text);
  const span = Math.min((endOf(lines, index, durationMs) - line.t) * SUNG_SHARE, MAX_SUNG_MS);
  const weights = words.map((w) => w.trim().length + 2);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let at = line.t;
  let lit = 0;
  for (const weight of weights) {
    if (at > ms + LEAD_MS) break;
    lit += 1;
    at += (weight / total) * span;
  }
  return lit;
};

/** How far through a break (an empty line, or the intro at -1) the song is, 0 to 1. */
export const breakShare = (lines, index, ms, durationMs) => {
  const start = index < 0 ? 0 : (lines[index]?.t ?? 0);
  const end = index < 0 ? (lines[0]?.t ?? 0) : endOf(lines, index, durationMs);
  return end > start ? Math.min(1, Math.max(0, (ms - start) / (end - start))) : 1;
};
