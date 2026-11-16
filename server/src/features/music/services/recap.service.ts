import { QueryTypes } from 'sequelize';
import sequelize from '@/utils/sequelize';
import { loadSongData } from './listener.service';
import { moodByKey } from './moods';
import { songMoods } from './mood.service';
import { normalize } from './play-next.scoring';
import { hourBandOf, WEEK_DAYS, weekStartOf, type HourBand } from './personal.scoring';

type SongData = Record<string, unknown>;

/** Shorter than this is a skip, not a listen. */
const MIN_PLAYED_MS = 30_000;
const TOP = 5;

interface SongWeek {
  songId: string;
  singer: string | null;
  singerId: string | null;
  singerImage: string | null;
  plays: number;
  playedMs: number;
  /** First listened to this week, ever. */
  discovered: boolean;
  /** Local hours of each listen. */
  hours: number[];
  days: string[];
}

export interface Recap {
  from: string;
  to: string;
  minutes: number;
  previousMinutes: number;
  daysListened: number;
  songsPlayed: number;
  discoveries: number;
  topSongs: Array<{ song: SongData; plays: number }>;
  topArtists: Array<{ id: string | null; name: string; image: string | null; minutes: number }>;
  topMood: { key: string; title: string } | null;
  peak: HourBand | null;
}

/** The last seven days of one listener's listening, in their own time zone. */
const DAY_MS = 24 * 60 * 60 * 1000;

export const getRecap = async (userId: number, tzOffsetMinutes: number): Promise<Recap> => {
  const now = Date.now();
  const since = weekStartOf(now, tzOffsetMinutes);
  const previousSince = new Date(since.getTime() - WEEK_DAYS * DAY_MS);
  // One aggregate over play events, which a model can't express in one statement.
  const rows = await sequelize.query<{
    songId: string;
    singer: string | null;
    singerId: string | null;
    singerImage: string | null;
    plays: string;
    playedMs: string;
    firstEver: Date | null;
    hours: number[];
    days: string[];
  }>(
    `
    WITH local AS (
      SELECT e."songRefId", e."playedMs",
        (e."startedAt" AT TIME ZONE 'UTC') - make_interval(mins => :offset) AS at
      FROM play_events e
      WHERE e."userId" = :userId
        AND e."startedAt" >= :since
        AND e."playedMs" >= :minPlayed
    )
    SELECT s."songId",
      s."songData"#>>'{artist_map,primary_artists,0,name}' AS singer,
      s."songData"#>>'{artist_map,primary_artists,0,id}' AS "singerId",
      s."songData"#>>'{artist_map,primary_artists,0,image,1,link}' AS "singerImage",
      COUNT(*) AS plays,
      SUM(l."playedMs") AS "playedMs",
      -- History rows are made on a song's first play ever, long before play events existed.
      (SELECT h.createdat FROM history_songs h
        WHERE h."userId" = :userId AND h."songRefId" = l."songRefId") AS "firstEver",
      ARRAY_AGG(EXTRACT(HOUR FROM l.at)::int) AS hours,
      ARRAY_AGG(TO_CHAR(l.at, 'YYYY-MM-DD')) AS days
    FROM local l
    JOIN songs s ON s.id = l."songRefId"
    GROUP BY l."songRefId", s.id
    `,
    {
      replacements: { userId, offset: tzOffsetMinutes, since, minPlayed: MIN_PLAYED_MS },
      type: QueryTypes.SELECT,
    }
  );
  const [previous] = await sequelize.query<{ playedMs: string | null }>(
    `
    SELECT SUM("playedMs") AS "playedMs" FROM play_events
    WHERE "userId" = :userId
      AND "startedAt" >= :previousSince AND "startedAt" < :since
    `,
    { replacements: { userId, since, previousSince }, type: QueryTypes.SELECT }
  );

  const weekStart = since.getTime();
  const songs: SongWeek[] = rows.map((row) => ({
    songId: row.songId,
    singer: row.singer,
    singerId: row.singerId,
    singerImage: row.singerImage,
    plays: Number(row.plays),
    playedMs: Number(row.playedMs),
    discovered: !!row.firstEver && new Date(row.firstEver).getTime() >= weekStart,
    hours: row.hours,
    days: row.days,
  }));

  const artists = new Map<string, Recap['topArtists'][number] & { ms: number }>();
  for (const song of songs) {
    if (!song.singer) continue;
    const key = normalize(song.singer);
    const entry = artists.get(key) ?? {
      id: song.singerId,
      name: song.singer,
      image: song.singerImage,
      minutes: 0,
      ms: 0,
    };
    entry.ms += song.playedMs;
    artists.set(key, entry);
  }

  const moods = await songMoods(songs.map((song) => song.songId));
  const moodPlays = new Map<string, number>();
  const bandPlays = new Map<HourBand, number>();
  for (const song of songs) {
    const mood = moods.get(song.songId);
    if (mood) moodPlays.set(mood, (moodPlays.get(mood) ?? 0) + song.plays);
    for (const hour of song.hours) {
      const band = hourBandOf(hour);
      bandPlays.set(band, (bandPlays.get(band) ?? 0) + 1);
    }
  }
  const topOf = <K>(counts: Map<K, number>): K | null =>
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const moodKey = topOf(moodPlays);
  const mood = moodKey ? moodByKey(moodKey) : undefined;

  const top = [...songs].sort((a, b) => b.plays - a.plays || b.playedMs - a.playedMs).slice(0, TOP);
  const topData = new Map(
    (await loadSongData(top.map((song) => song.songId))).map((data) => [String(data.id), data])
  );
  const totalMs = songs.reduce((sum, song) => sum + song.playedMs, 0);
  const localToday = new Date(now - tzOffsetMinutes * 60_000);
  const localStart = new Date(since.getTime() - tzOffsetMinutes * 60_000);

  return {
    from: localStart.toISOString().slice(0, 10),
    to: localToday.toISOString().slice(0, 10),
    minutes: Math.round(totalMs / 60_000),
    previousMinutes: Math.round(Number(previous?.playedMs ?? 0) / 60_000),
    daysListened: new Set(songs.flatMap((song) => song.days)).size,
    songsPlayed: songs.length,
    discoveries: songs.filter((song) => song.discovered).length,
    topSongs: top.flatMap((song) => {
      const data = topData.get(song.songId);
      return data ? [{ song: data, plays: song.plays }] : [];
    }),
    topArtists: [...artists.values()]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, TOP)
      .map(({ ms, ...artist }) => ({ ...artist, minutes: Math.max(1, Math.round(ms / 60_000)) })),
    topMood: mood ? { key: mood.key, title: mood.title } : null,
    peak: topOf(bandPlays),
  };
};
