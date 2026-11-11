import { Op, QueryTypes } from 'sequelize';
import { Song, HistorySong } from '@/models/index';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';
import {
  dedupKey,
  hasPlausibleLength,
  hasVariantTag,
  isVersionOfSeed,
  normalize,
  rankWithDiversity,
  scoreSong,
  type ScoredItem,
  type SongEntry,
} from './play-next.scoring';

const CACHE_TTL = 30 * 24 * 60 * 60;
/** Playlists change, so combined results are recomputed sooner. */
const HYBRID_CACHE_TTL = 7 * 24 * 60 * 60;
const MAX_LINKED_SONGS = 150;
const SINGLE_ARTIST_PLAYLIST_WEIGHT = 0.25;
const LINK_SHRINKAGE = 2;

/** Read on each call so that switching the flag and restarting takes effect cleanly. */
const isHybridEngine = (): boolean => process.env.RECO_ENGINE === 'hybrid';
const cacheKey = (songId: string): string => `${isHybridEngine() ? 'pn:h1:' : 'pn:v6:'}${songId}`;
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

const extractSingers = (songData: Record<string, unknown>, artistNamesStr = ''): string[] => {
  const artistMap = songData?.artist_map as Record<string, unknown> | undefined;
  const primaryArtists = ((artistMap?.primary_artists as Array<{ name?: string }>) || [])
    .map((a) => normalize(a?.name))
    .filter(Boolean);

  const artists = ((artistMap?.artists as Array<{ name?: string; role?: string }>) || [])
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
    (s) => s && s !== 'unknown'
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

const getCoOccurrenceCandidates = async (
  baseSongRefId: number
): Promise<Array<{ song: SongRow; coWeight: number }>> => {
  if (!baseSongRefId) return [];
  try {
    const sequelize = Song.sequelize!;
    const historyQuery = `
      SELECT hs2."songRefId", COUNT(*) as co_weight
      FROM history_songs hs1
      INNER JOIN history_songs hs2 ON hs1."userId" = hs2."userId" AND hs1."songRefId" != hs2."songRefId"
      WHERE hs1."songRefId" = :baseSongRefId
      GROUP BY hs2."songRefId"
      ORDER BY co_weight DESC
      LIMIT 40
    `;
    const historyResults = (await sequelize.query(historyQuery, {
      replacements: { baseSongRefId },
      type: QueryTypes.SELECT,
    })) as Array<{ songRefId: number; co_weight: string }>;

    const playlistQuery = `
      SELECT ps2."songRefId", COUNT(*) as co_weight
      FROM playlist_songs ps1
      INNER JOIN playlist_songs ps2 ON ps1."playlistId" = ps2."playlistId" AND ps1."songRefId" != ps2."songRefId"
      WHERE ps1."songRefId" = :baseSongRefId
      GROUP BY ps2."songRefId"
      ORDER BY co_weight DESC
      LIMIT 40
    `;
    const playlistResults = (await sequelize.query(playlistQuery, {
      replacements: { baseSongRefId },
      type: QueryTypes.SELECT,
    })) as Array<{ songRefId: number; co_weight: string }>;

    const coMap = new Map<number, number>();
    for (const r of historyResults) {
      coMap.set(r.songRefId, (coMap.get(r.songRefId) || 0) + parseInt(r.co_weight, 10) * 2);
    }
    for (const r of playlistResults) {
      coMap.set(r.songRefId, (coMap.get(r.songRefId) || 0) + parseInt(r.co_weight, 10) * 3);
    }

    if (coMap.size === 0) return [];

    const refIds = [...coMap.keys()];
    const coSongs = (await Song.findAll({
      where: { id: { [Op.in]: refIds } },
      attributes: [...SONG_ATTRS],
      raw: true,
    })) as unknown as SongRow[];

    return coSongs.map((s) => ({ song: s, coWeight: coMap.get(s.id) || 1 }));
  } catch (err) {
    console.error('[PlayNext] Co-occurrence search error:', (err as Error).message);
    return [];
  }
};

/** Songs that editors place with the seed, strongest first, in the seed's language. */
const getLinkedCandidates = async (
  baseSongId: string,
  language: string
): Promise<Array<{ song: SongRow; linkStrength: number }>> => {
  if (!language) return [];
  try {
    const weight = `CASE WHEN p."isSingleArtist" THEN ${SINGLE_ARTIST_PLAYLIST_WEIGHT} ELSE 1 END`;
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
  const candidateMap = new Map<
    string,
    { songRow: SongRow; coWeight: number; linkStrength?: number }
  >();

  const coCandidates = await getCoOccurrenceCandidates(baseSongRow.id);
  for (const item of coCandidates) {
    if (item.song.songId !== baseSongId) {
      candidateMap.set(item.song.songId, { songRow: item.song, coWeight: item.coWeight });
    }
  }

  if (isHybridEngine()) {
    const linked = await getLinkedCandidates(baseSongId, baseSong.language);
    for (const { song, linkStrength } of linked) {
      const existing = candidateMap.get(song.songId);
      candidateMap.set(song.songId, {
        songRow: song,
        coWeight: existing?.coWeight ?? 0,
        linkStrength,
      });
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
      if (!candidateMap.has(c.songId)) candidateMap.set(c.songId, { songRow: c, coWeight: 0 });
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
        if (!candidateMap.has(c.songId)) candidateMap.set(c.songId, { songRow: c, coWeight: 0 });
      }
    }
  }

  if (candidateMap.size < 40 && baseSong.language) {
    const catalogFallback = (await Song.findAll({
      where: { language: baseSong.language, songId: { [Op.ne]: baseSongId } },
      attributes: [...SONG_ATTRS],
      order: [['createdAt', 'DESC']],
      raw: true,
      limit: 100,
    })) as unknown as SongRow[];
    for (const c of catalogFallback) {
      if (!candidateMap.has(c.songId)) candidateMap.set(c.songId, { songRow: c, coWeight: 0 });
    }
  }

  const seen = new Set<string>();
  const scored: ScoredItem[] = [];

  for (const { songRow, coWeight, linkStrength } of candidateMap.values()) {
    const entry = buildEntry(songRow);
    if (isVersionOfSeed(entry.name, baseSong.name) || !hasPlausibleLength(entry, baseSong)) {
      continue;
    }
    const dk = dedupKey(entry.name, entry.singers[0] || 'unknown');
    if (seen.has(dk)) continue;
    seen.add(dk);

    const score = scoreSong(entry, baseSong, coWeight, linkStrength);
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

interface UserHistoryResult {
  recentSongIds: Set<string>;
  historyMap: Map<string, { playedCount: number; skipCount: number; likeStatus: boolean }>;
}

const getUserHistory = async (userId: number): Promise<UserHistoryResult> => {
  if (!userId) return { recentSongIds: new Set(), historyMap: new Map() };

  const recentEntries = await HistorySong.findAll({
    where: { userId },
    attributes: ['songRefId', 'playedCount', 'skipCount', 'likeStatus', 'lastPlayedAt'],
    order: [['lastPlayedAt', 'DESC']],
    limit: 50,
    raw: true,
  });

  const recentSongIds = new Set<string>();
  const historyMap = new Map<
    string,
    { playedCount: number; skipCount: number; likeStatus: boolean }
  >();

  const songIdsByRefId = await Song.findAll({
    where: { id: recentEntries.map((e) => e.songRefId) },
    attributes: ['id', 'songId'],
    raw: true,
  });

  const refIdToSongId = new Map<number, string>();
  for (const s of songIdsByRefId) refIdToSongId.set(s.id, s.songId);

  for (let i = 0; i < recentEntries.length; i++) {
    const entry = recentEntries[i]!;
    const songId = refIdToSongId.get(entry.songRefId);
    if (!songId) continue;

    if (i < 15) recentSongIds.add(songId);

    historyMap.set(songId, {
      playedCount: entry.playedCount || 0,
      skipCount: entry.skipCount || 0,
      likeStatus: entry.likeStatus || false,
    });
  }

  return { recentSongIds, historyMap };
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

  let resultIds = cachedIds.filter((id) => !excludeSongIds.includes(id));

  if (userId) {
    const { recentSongIds, historyMap } = await getUserHistory(userId);

    const personalized = resultIds.map((id) => {
      let penalty = 0;
      const history = historyMap.get(id);
      if (history) {
        if (recentSongIds.has(id)) penalty -= 50;
        if (history.skipCount >= 5) penalty -= 40;
        else if (history.skipCount >= 2) penalty -= 25;
        if (history.playedCount > 10) penalty -= 20;
        if (history.likeStatus) penalty += 30;
      }
      return { songId: id, score: penalty };
    });

    personalized.sort((a, b) => b.score - a.score);
    resultIds = personalized.map((p) => p.songId);
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
