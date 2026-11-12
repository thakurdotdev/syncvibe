import { Op, QueryTypes } from 'sequelize';
import { Song, HistorySong } from '@/models/index';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';
import {
  dedupKey,
  hasPlausibleLength,
  hasVariantTag,
  isRelatedToSeed,
  isVersionOfSeed,
  normalize,
  rankWithDiversity,
  scoreSong,
  type ScoredItem,
  type SongEntry,
} from './play-next.scoring';
import { personalizePlayNext, type PastListen } from './play-next.personal';
import { getDislikes } from './dislike.service';

const CACHE_TTL = 30 * 24 * 60 * 60;
/** Playlists change, so combined results are recomputed sooner. */
const HYBRID_CACHE_TTL = 7 * 24 * 60 * 60;
const MAX_LINKED_SONGS = 150;
const SINGLE_ARTIST_PLAYLIST_WEIGHT = 0.25;
/**
 * Popularity charts ("Top 50", "Trending", "Most Searched") hold whatever is big this week, so
 * being on one says little about fit. One that also names a mood or genre is a real list.
 */
const CHART_PLAYLIST_WEIGHT = 0.25;
const CHART_NAME =
  '(top ?[0-9]+|trending|superhits|hit songs|most searched|viral|new releases?|chartbusters?|top songs)';
const MOOD_OR_GENRE_NAME =
  '(love|romantic|dance|party|sad|hip ?hop|rap|devotional|bhakti|lo-?fi|workout|chill|rock|retro|[0-9]{4}s|decade)';
const LINK_SHRINKAGE = 2;

/** Read on each call so that switching the flag and restarting takes effect cleanly. */
const isHybridEngine = (): boolean => process.env.RECO_ENGINE === 'hybrid';
const cacheKey = (songId: string): string => `${isHybridEngine() ? 'pn:h2:' : 'pn:v7:'}${songId}`;
const cacheTtl = (): number => (isHybridEngine() ? HYBRID_CACHE_TTL : CACHE_TTL);
const SONG_ATTRS = [
  'id',
  'songId',
  'name',
  'artistNames',
  'albumName',
  'language',
  'duration',
  'songData',
] as const;
const MIN_SCORE_THRESHOLD = 25;

interface SongRow {
  id: number;
  songId: string;
  name: string;
  artistNames: string;
  albumName: string;
  language: string;
  duration: number;
  songData: Record<string, unknown>;
  year?: string;
}

const buildArtistILike = (name: string) => {
  if (name.length <= 3) {
    return {
      [Op.or]: [
        { artistNames: { [Op.iLike]: `${name}` } },
        { artistNames: { [Op.iLike]: `${name}, %` } },
        { artistNames: { [Op.iLike]: `%, ${name}` } },
        { artistNames: { [Op.iLike]: `%, ${name}, %` } },
      ],
    };
  }
  return { artistNames: { [Op.iLike]: `%${name}%` } };
};

/**
 * Saavn credits lyricists as "Singer, Lyricist" and lists actors in `artistNames`, so both are
 * left out: a shared lyricist or actor says little about how two songs sound.
 */
const NOT_SINGING = ['lyricist', 'starring'];

const extractSingers = (songData: Record<string, unknown>, artistNamesStr = ''): string[] => {
  const artistMap = songData?.artist_map as Record<string, unknown> | undefined;
  const credits = (artistMap?.artists as Array<{ name?: string; role?: string }>) || [];
  const notSinging = new Set(
    credits
      .filter((a) => NOT_SINGING.some((role) => (a?.role || '').toLowerCase().includes(role)))
      .map((a) => normalize(a?.name))
  );

  const primaryArtists = ((artistMap?.primary_artists as Array<{ name?: string }>) || [])
    .map((a) => normalize(a?.name))
    .filter(Boolean);

  const artists = credits
    .filter((a) => {
      const role = (a?.role || '').toLowerCase();
      return role.includes('singer') || role.includes('primary') || !role;
    })
    .map((a) => normalize(a?.name))
    .filter(Boolean);

  let subtitleSinger = '';
  const subtitle = songData?.subtitle as string | undefined;
  if (subtitle?.includes(' - ')) {
    subtitleSinger = normalize(subtitle.split(' - ')[0]);
  }

  const fromStr = (artistNamesStr || '')
    .split(',')
    .map((s) => normalize(s))
    .filter(Boolean);

  return [...new Set([...primaryArtists, ...artists, subtitleSinger, ...fromStr])].filter(
    (s) => s && s !== 'unknown' && !notSinging.has(s)
  );
};

const extractMusicDirectors = (songData: Record<string, unknown>): string[] => {
  const artistMap = songData?.artist_map as Record<string, unknown> | undefined;
  const artists = (artistMap?.artists as Array<{ name?: string; role?: string }>) || [];
  const fromRole = artists
    .filter((a) => {
      const role = (a?.role || '').toLowerCase();
      return role.includes('music') || role.includes('composer');
    })
    .map((a) => normalize(a?.name));

  const fromField = ((songData?.music as string) || '')
    .split(',')
    .map((c) => normalize(c))
    .filter((c) => c && c !== 'unknown');

  return [...new Set([...fromRole, ...fromField])].filter(Boolean);
};

const extractLyricists = (songData: Record<string, unknown>): string[] => {
  const artistMap = songData?.artist_map as Record<string, unknown> | undefined;
  const artists = (artistMap?.artists as Array<{ name?: string; role?: string }>) || [];
  return artists
    .filter((a) => (a?.role || '').toLowerCase().includes('lyricist'))
    .map((a) => normalize(a?.name))
    .filter(Boolean);
};

const buildEntry = (song: SongRow): SongEntry => {
  const sd = song.songData || {};
  const rawYear = parseInt((sd.year as string) || song.year || '0', 10);
  return {
    id: song.id,
    songId: song.songId,
    name: song.name || (sd.name as string) || 'Unknown',
    singers: extractSingers(sd, song.artistNames),
    musicDirectors: extractMusicDirectors(sd),
    lyricists: extractLyricists(sd),
    albumName: normalize(song.albumName || (sd.album as string) || ''),
    albumId: (sd.album_id as string) || '',
    language: normalize(song.language || (sd.language as string) || ''),
    duration: song.duration || (sd.duration as number) || 0,
    playCount: parseInt(sd.play_count as string, 10) || 0,
    year: isNaN(rawYear) ? 0 : rawYear,
    isVariant: hasVariantTag(song.name || (sd.name as string) || ''),
  };
};

/** Songs that editors place with the seed, strongest first, in the seed's language. */
const getLinkedCandidates = async (
  baseSongId: string,
  language: string
): Promise<Array<{ song: SongRow; linkStrength: number }>> => {
  if (!language) return [];
  try {
    const weight = `CASE WHEN p."isSingleArtist" THEN ${SINGLE_ARTIST_PLAYLIST_WEIGHT}
      WHEN p.name ~* :chartName AND p.name !~* :moodName THEN ${CHART_PLAYLIST_WEIGHT}
      ELSE 1 END`;
    const rows = (await sequelize.query(
      `
      WITH seed AS (
        SELECT ps."playlistId", ${weight} AS weight
        FROM editorial_playlist_songs ps
        JOIN editorial_playlists p ON p.id = ps."playlistId"
        WHERE ps."songId" = :baseSongId
      ),
      together AS (
        SELECT ps."songId", SUM(seed.weight) AS shared
        FROM seed
        JOIN editorial_playlist_songs ps ON ps."playlistId" = seed."playlistId"
        WHERE ps."songId" <> :baseSongId
        GROUP BY ps."songId"
      ),
      appearances AS (
        SELECT ps."songId", SUM(${weight}) AS total
        FROM editorial_playlist_songs ps
        JOIN editorial_playlists p ON p.id = ps."playlistId"
        WHERE ps."songId" IN (SELECT "songId" FROM together)
        GROUP BY ps."songId"
      )
      SELECT s.id, s."songId", s.name, s."artistNames", s."albumName", s.language, s.duration,
        s."songData",
        t.shared / (SQRT((SELECT SUM(weight) FROM seed) * a.total) + :shrinkage) AS strength
      FROM together t
      JOIN appearances a ON a."songId" = t."songId"
      JOIN songs s ON s."songId" = t."songId"
      WHERE s.language = :language
      ORDER BY strength DESC
      LIMIT :limit
      `,
      {
        replacements: {
          baseSongId,
          language,
          shrinkage: LINK_SHRINKAGE,
          chartName: CHART_NAME,
          moodName: MOOD_OR_GENRE_NAME,
          limit: MAX_LINKED_SONGS,
        },
        type: QueryTypes.SELECT,
      }
    )) as Array<SongRow & { strength: string }>;
    return rows.map(({ strength, ...song }) => ({ song, linkStrength: Number(strength) }));
  } catch (err) {
    // The tables may not exist yet: carry on with the other candidates.
    console.error('[PlayNext] Playlist link search error:', (err as Error).message);
    return [];
  }
};

/**
 * Same language first and then the best known, so a big singer's 250 slots aren't an arbitrary
 * pick that can crowd out the seed's own language.
 */
const candidateOrder = (language: string) =>
  sequelize.literal(
    `("language" = ${sequelize.escape(language)}) DESC NULLS LAST, ` +
      `CASE WHEN "songData"->>'play_count' ~ '^[0-9]+$' ` +
      `THEN ("songData"->>'play_count')::bigint ELSE 0 END DESC`
  );

const computeForSong = async (baseSongId: string): Promise<string[]> => {
  const baseSongRow = (await Song.findOne({
    where: { songId: baseSongId },
    attributes: [...SONG_ATTRS],
    raw: true,
  })) as unknown as SongRow | null;
  if (!baseSongRow) return [];

  const baseSong = buildEntry(baseSongRow);
  // Only the seed decides what follows it. Co-listening was dropped: with a handful of
  // listeners it mostly reflected one person's mixed taste, so party songs followed sad ones.
  const candidateMap = new Map<string, { songRow: SongRow; linkStrength?: number }>();

  if (isHybridEngine()) {
    const linked = await getLinkedCandidates(baseSongId, baseSong.language);
    for (const { song, linkStrength } of linked) {
      candidateMap.set(song.songId, { songRow: song, linkStrength });
    }
  }

  const singerConditions = baseSong.singers
    .filter((s) => s && s !== 'unknown')
    .slice(0, 5)
    .map(buildArtistILike);
  const albumCondition = baseSongRow.albumName ? [{ albumName: baseSongRow.albumName }] : [];
  const primaryConditions = [...singerConditions, ...albumCondition];

  if (primaryConditions.length > 0) {
    const primaryCandidates = (await Song.findAll({
      where: { [Op.or]: primaryConditions, songId: { [Op.ne]: baseSongId } },
      attributes: [...SONG_ATTRS],
      order: candidateOrder(baseSong.language),
      raw: true,
      limit: 250,
    })) as unknown as SongRow[];
    for (const c of primaryCandidates) {
      if (!candidateMap.has(c.songId)) candidateMap.set(c.songId, { songRow: c });
    }
  }

  if (candidateMap.size < 100) {
    const mdConditions = baseSong.musicDirectors
      .filter((m) => m && m !== 'unknown')
      .slice(0, 3)
      .map(buildArtistILike);
    if (mdConditions.length > 0 && baseSong.language) {
      const supplementary = (await Song.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: mdConditions },
            { language: baseSong.language },
            { songId: { [Op.ne]: baseSongId } },
          ],
        },
        attributes: [...SONG_ATTRS],
        order: candidateOrder(baseSong.language),
        raw: true,
        limit: 150,
      })) as unknown as SongRow[];
      for (const c of supplementary) {
        if (!candidateMap.has(c.songId)) candidateMap.set(c.songId, { songRow: c });
      }
    }
  }

  const seen = new Set<string>();
  const scored: ScoredItem[] = [];

  for (const { songRow, linkStrength } of candidateMap.values()) {
    const entry = buildEntry(songRow);
    if (
      isVersionOfSeed(entry.name, baseSong.name) ||
      !hasPlausibleLength(entry, baseSong) ||
      !isRelatedToSeed(entry, baseSong, linkStrength)
    ) {
      continue;
    }
    const dk = dedupKey(entry.name, entry.singers[0] || 'unknown');
    if (seen.has(dk)) continue;
    seen.add(dk);

    const score = scoreSong(entry, baseSong, linkStrength);
    if (score < MIN_SCORE_THRESHOLD) continue;

    scored.push({
      songId: entry.songId,
      score,
      name: entry.name,
      topSinger: entry.singers[0] || 'unknown',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return rankWithDiversity(scored, 100);
};

/** The listener's past plays of these songs only, keyed by songId. */
const getPastListens = async (
  userId: number,
  candidates: Array<{ id: number; songId: string }>
): Promise<Map<string, PastListen>> => {
  const songIdByRef = new Map(candidates.map((song) => [song.id, song.songId]));
  const rows = await HistorySong.findAll({
    where: { userId, songRefId: { [Op.in]: [...songIdByRef.keys()] } },
    attributes: ['songRefId', 'playedCount', 'skipCount', 'lastPlayedAt'],
    raw: true,
  });
  const listens = new Map<string, PastListen>();
  for (const row of rows) {
    const songId = songIdByRef.get(row.songRefId);
    if (!songId) continue;
    listens.set(songId, {
      lastPlayedAt: row.lastPlayedAt,
      playedCount: row.playedCount || 0,
      skipCount: row.skipCount || 0,
    });
  }
  return listens;
};

/** Songs that fit after this one, best first, the same for every listener. */
export const getRelatedSongIds = async (baseSongId: string): Promise<string[]> => {
  const cached = await cache.get<string[]>(cacheKey(baseSongId));
  if (cached) return cached;

  const computed = await computeForSong(baseSongId);
  if (computed.length > 0) await cache.set(cacheKey(baseSongId), computed, cacheTtl());
  return computed;
};

interface PlayNextParams {
  baseSongId: string;
  userId?: number | null;
  limit?: number;
  excludeSongIds?: string[];
}

export const getPlayNextSongs = async ({
  baseSongId,
  userId = null,
  limit = 20,
  excludeSongIds = [],
}: PlayNextParams): Promise<Array<Record<string, unknown>>> => {
  const cachedIds = await getRelatedSongIds(baseSongId);
  if (cachedIds.length === 0) return [];

  const excluded = new Set(excludeSongIds);
  let resultIds = cachedIds.filter((id) => !excluded.has(id));

  if (userId && resultIds.length > 0) {
    const [candidates, dislikes] = await Promise.all([
      Song.findAll({
        where: { songId: { [Op.in]: resultIds } },
        attributes: ['id', 'songId', 'name'],
        raw: true,
      }),
      getDislikes(userId),
    ]);
    const nameById = new Map(candidates.map((song) => [song.songId, song.name || '']));
    resultIds = personalizePlayNext({
      candidates: resultIds.map((songId) => ({ songId, name: nameById.get(songId) ?? '' })),
      history: await getPastListens(userId, candidates),
      dislikedIds: dislikes.songIds,
      blockedTitles: dislikes.titles,
      now: new Date(),
      limit,
    });
  }

  const finalIds = resultIds.slice(0, limit);
  if (finalIds.length === 0) return [];

  const songs = await Song.findAll({
    where: { songId: { [Op.in]: finalIds } },
    attributes: ['songId', 'songData'],
    raw: true,
  });

  const dataMap = new Map<string, Record<string, unknown>>();
  for (const s of songs) dataMap.set(s.songId, s.songData as Record<string, unknown>);

  return finalIds.map((id) => dataMap.get(id)).filter((d): d is Record<string, unknown> => !!d);
};

export const rebuildAllPlayNext = async (): Promise<{ processed: number; total: number }> => {
  const allSongs = await Song.findAll({ attributes: ['songId'], raw: true });
  const total = allSongs.length;
  let processed = 0;
  const BATCH = 20;

  for (let i = 0; i < total; i += BATCH) {
    const batch = allSongs.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async ({ songId }) => {
        const ids = await computeForSong(songId);
        if (ids.length > 0) {
          await cache.set(cacheKey(songId), ids, cacheTtl());
        }
        processed++;
      })
    );
    console.log(`[PlayNext] Rebuilt ${processed}/${total}`);
  }

  await cache.set('playnext:last_rebuild', Date.now(), CACHE_TTL);
  console.log(`[PlayNext] Rebuild complete: ${processed} songs processed`);
  return { processed, total };
};

export const invalidateSong = async (songId: string): Promise<void> => {
  await cache.del(cacheKey(songId));
};
