import { Song, SongLyrics } from '@/models/index';
import type { LyricLine } from '@/models/music/song-lyrics.model';
import {
  cleanPlain,
  cleanTitle,
  factsOf,
  lyricsOf,
  pickEntry,
  type LyricsEntry,
  type SongFacts,
} from './lyrics.logic';

/*
 * A song's lyrics: timed ones from LRCLIB when an entry there is this song, otherwise Saavn's
 * plain text. Each song is looked up once and kept in song_lyrics; songs without any are tried
 * again after a while, since lyrics sites keep growing.
 */

const SONG_API_URL = process.env.SONG_API_URL || 'https://song.thakur.dev';
const LRCLIB_URL = 'https://lrclib.net/api';
// LRCLIB asks clients to name themselves.
const USER_AGENT = 'SyncVibe (https://syncvibe.thakur.dev)';
const TIMEOUT_MS = 8_000;

const DAY_MS = 24 * 60 * 60 * 1000;
/** A song with no lyrics is looked up again after this long. */
const RETRY_NONE_MS = 14 * DAY_MS;
/** Plain lyrics are looked up again after this long, in case timed ones have appeared. */
const RETRY_PLAIN_MS = 30 * DAY_MS;

export type LyricsResult =
  | { kind: 'synced'; lines: LyricLine[]; source: string }
  | { kind: 'plain'; text: string; source: string }
  | { kind: 'none' };

type Stored = Pick<SongLyrics, 'kind' | 'lines' | 'plainText' | 'source'>;

const toResult = (row: Stored): LyricsResult => {
  if (row.kind === 'synced' && row.lines?.length) {
    return { kind: 'synced', lines: row.lines, source: row.source ?? 'lrclib' };
  }
  if (row.kind !== 'none' && row.plainText) {
    return { kind: 'plain', text: row.plainText, source: row.source ?? 'saavn' };
  }
  return { kind: 'none' };
};

const isStale = (row: SongLyrics) => {
  const age = Date.now() - new Date(row.fetchedAt).getTime();
  if (row.kind === 'none') return age > RETRY_NONE_MS;
  if (row.kind === 'plain') return age > RETRY_PLAIN_MS;
  return false;
};

/** LRCLIB answers 429 when asked too often; it's left alone for a while after that. */
const LRCLIB_COOLDOWN_MS = 2 * 60 * 1000;
let lrclibPausedUntil = 0;

const getJson = async (url: string): Promise<unknown> => {
  const lrclib = url.startsWith(LRCLIB_URL);
  if (lrclib && Date.now() < lrclibPausedUntil) throw new Error('LRCLIB is cooling down');
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 404) return null;
  if (response.status === 429 && lrclib) lrclibPausedUntil = Date.now() + LRCLIB_COOLDOWN_MS;
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
};

const songDataOf = async (songId: string): Promise<Record<string, unknown> | null> => {
  const stored = await Song.findOne({ where: { songId }, attributes: ['songData'] });
  if (stored?.songData) return stored.songData;
  const body = (await getJson(`${SONG_API_URL}/song?id=${encodeURIComponent(songId)}`)) as {
    data?: { songs?: Array<Record<string, unknown>> };
  } | null;
  return body?.data?.songs?.[0] ?? null;
};

const lrclibCandidates = async (
  song: SongFacts,
  rejected: ReadonlySet<string>
): Promise<LyricsEntry[]> => {
  const title = cleanTitle(song.title);
  const artist = song.artists[0] ?? '';
  const found: LyricsEntry[] = [];

  // The exact lookup first: cheap for LRCLIB, and right whenever our credits match theirs.
  if (artist && song.duration > 0) {
    const params = new URLSearchParams({
      track_name: title,
      artist_name: artist,
      duration: String(Math.round(song.duration)),
    });
    if (song.album) params.set('album_name', song.album);
    const exact = (await getJson(`${LRCLIB_URL}/get?${params}`)) as LyricsEntry | null;
    if (exact?.id) found.push(exact);
    // Timed and this song: no need to search.
    if (exact?.id && exact.syncedLyrics && pickEntry(song, [exact], rejected)) return found;
  }

  // Then a search by title: our first credit is often not the one LRCLIB has.
  const search = (await getJson(
    `${LRCLIB_URL}/search?${new URLSearchParams({ track_name: title })}`
  )) as LyricsEntry[] | null;
  if (Array.isArray(search)) found.push(...search.slice(0, 20));
  return found;
};

const saavnPlain = async (songId: string): Promise<string | null> => {
  const body = (await getJson(`${SONG_API_URL}/get/lyrics?id=${encodeURIComponent(songId)}`)) as {
    data?: { lyrics?: string } | null;
  } | null;
  return cleanPlain(body?.data?.lyrics);
};

export interface Found {
  kind: 'synced' | 'plain' | 'none';
  lines: LyricLine[] | null;
  plainText: string | null;
  source: string | null;
  sourceRef: string | null;
}

const NOTHING: Found = {
  kind: 'none',
  lines: null,
  plainText: null,
  source: null,
  sourceRef: null,
};

const lookUp = async (songId: string, rejected: Set<string>): Promise<Found> => {
  const songData = await songDataOf(songId);
  return songData ? findLyricsFor(songId, songData, rejected) : NOTHING;
};

/** Looks a song up at the sources, ruling out entries reported wrong. Exported for checks. */
export const findLyricsFor = async (
  songId: string,
  songData: Record<string, unknown>,
  rejected: Set<string>
): Promise<Found> => {
  const facts = factsOf(songData);
  if (!facts.title) return NOTHING;

  // If LRCLIB is down this throws, so "none" isn't remembered for a song that may have lyrics.
  const entry = pickEntry(facts, await lrclibCandidates(facts, rejected), rejected);
  const lyrics = entry ? lyricsOf(entry) : null;
  if (entry && lyrics?.kind === 'synced') {
    return {
      kind: 'synced',
      lines: lyrics.lines,
      plainText: lyrics.plain,
      source: 'lrclib',
      sourceRef: String(entry.id),
    };
  }
  let fallback: Found = NOTHING;
  if (entry && lyrics?.kind === 'plain') {
    fallback = {
      kind: 'plain',
      lines: null,
      plainText: lyrics.plain,
      source: 'lrclib',
      sourceRef: String(entry.id),
    };
  }

  if (!rejected.has('saavn') && songData.has_lyrics !== 'false' && songData.has_lyrics !== false) {
    const text = await saavnPlain(songId).catch(() => null);
    if (text)
      return { kind: 'plain', lines: null, plainText: text, source: 'saavn', sourceRef: 'saavn' };
  }
  return fallback;
};

/** One lookup per song at a time, however many devices ask at once (a room's song change). */
const inFlight = new Map<string, Promise<LyricsResult>>();

const resolve = (songId: string, rejected: Set<string>): Promise<LyricsResult> => {
  const pending = inFlight.get(songId);
  if (pending) return pending;
  const job = (async () => {
    const found = await lookUp(songId, rejected);
    await SongLyrics.upsert({
      songId,
      ...found,
      rejectedRefs: [...rejected],
      fetchedAt: new Date(),
    });
    return toResult(found);
  })().finally(() => inFlight.delete(songId));
  inFlight.set(songId, job);
  return job;
};

export const getLyrics = async (songId: string): Promise<LyricsResult> => {
  const row = await SongLyrics.findByPk(songId);
  if (row && !isStale(row)) return toResult(row);
  try {
    return await resolve(songId, new Set(row?.rejectedRefs ?? []));
  } catch (error) {
    console.warn('[Lyrics] Lookup failed:', (error as Error).message);
    // A site is down: whatever we had is better than nothing.
    return row ? toResult(row) : { kind: 'none' };
  }
};

/** Someone said these are the wrong song's lyrics: rule that entry out and look again. */
export const reportWrongLyrics = async (songId: string): Promise<LyricsResult> => {
  const row = await SongLyrics.findByPk(songId);
  if (!row || row.kind === 'none' || !row.sourceRef) return row ? toResult(row) : { kind: 'none' };
  const rejected = new Set([...row.rejectedRefs, row.sourceRef]);
  try {
    return await resolve(songId, rejected);
  } catch {
    await row.update({ kind: 'none', lines: null, plainText: null, rejectedRefs: [...rejected] });
    return { kind: 'none' };
  }
};
