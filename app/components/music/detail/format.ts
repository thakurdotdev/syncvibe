import type { Song } from '@/types/song';
import { convertToHttps } from '@/utils/getHttpsUrls';

/** 1.2K, 3.4M, 1.1B. Empty for nothing or zero, so a meta line can just skip it. */
export function compactCount(count: number | string | undefined | null): string {
  const n = typeof count === 'string' ? parseFloat(count) : count;
  if (!n || Number.isNaN(n)) return '';
  if (n >= 1e9) return `${trim(n / 1e9)}B`;
  if (n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e3) return `${trim(n / 1e3)}K`;
  return String(Math.round(n));
}

const trim = (n: number) => n.toFixed(1).replace(/\.0$/, '');

/** Song durations come as seconds, sometimes as a string. */
export const secondsOf = (song: Pick<Song, 'duration'> | null | undefined) => {
  const s = Number(song?.duration);
  return Number.isFinite(s) && s > 0 ? s : 0;
};

/** 3:42 */
export const clock = (seconds: number) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/** "46 min", "1 h 56 min": a whole list's length. Empty when no song says how long it is. */
export const runtime = (songs: Song[]) => {
  const total = songs.reduce((sum, song) => sum + secondsOf(song), 0);
  if (!total) return '';
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
};

/** "10 songs" */
export const songCount = (n: number) => `${n} ${n === 1 ? 'song' : 'songs'}`;

/** A cover in whatever shape the API sent it. Tier 2 is the 500px one, 1 the 150px one. */
export const coverOf = (image: unknown, tier: 0 | 1 | 2 = 2): string | undefined => {
  if (typeof image === 'string') return image ? convertToHttps(image) : undefined;
  if (!Array.isArray(image)) return undefined;
  const link = image[tier]?.link || image[2]?.link || image[1]?.link || image[0]?.link;
  return typeof link === 'string' && link ? convertToHttps(link) : undefined;
};

/** The first four distinct covers in a list: a mosaic for a playlist without its own picture. */
export const mosaicOf = (songs: Song[]) => {
  const seen = new Set<string>();
  for (const song of songs) {
    const uri = coverOf(song?.image, 1);
    if (uri && !seen.has(uri)) seen.add(uri);
    if (seen.size === 4) break;
  }
  return [...seen];
};

/**
 * The artists under a song's name. An album's songs read "Singer, Composer - Album", and the
 * album's own page already says which album it is.
 */
export const artistsLine = (song: Song, dropAlbum = false) => {
  const line = song.subtitle || song.artist_map?.artists?.[0]?.name || '';
  if (!dropAlbum || !song.album) return line;
  const suffix = ` - ${song.album}`;
  return line.endsWith(suffix) ? line.slice(0, -suffix.length) : line;
};

/** "4 April 2013" from "2013-04-04" (or "25-04-1987", the way artist birthdays come). */
export const longDate = (value?: string | null) => {
  if (!value) return '';
  const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  const date = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

// Some text from the catalogue was stored as UTF-8 read as Latin-1: "â€™" where "’" was meant.
const MOJIBAKE: [RegExp, string][] = [
  [/â€™/g, '’'],
  [/â€˜/g, '‘'],
  [/â€œ/g, '“'],
  [/â€\u009d/g, '”'],
  [/â€“/g, '–'],
  [/â€”/g, '—'],
  [/â€¦/g, '…'],
  [/Ã©/g, 'é'],
  [/&quot;/g, '"'],
  [/&amp;/g, '&'],
  [/&#039;/g, '’'],
];

export const cleanText = (text?: string | null) =>
  MOJIBAKE.reduce((out, [bad, good]) => out.replace(bad, good), text ?? '').trim();
