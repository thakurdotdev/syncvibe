import { Op, QueryTypes } from 'sequelize';
import { Song, HistorySong } from '@/models/index';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';

const SONG_API_URL = process.env.SONG_API_URL || 'https://song.thakur.dev';
const CACHE_PREFIX = 'pn:v5:';
const CACHE_TTL = 30 * 24 * 60 * 60;
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

interface SongEntry {
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

interface ScoredItem {
  songId: string;
  score: number;
  name: string;
  topSinger: string;
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

const VARIANT_TAGS = [
  'remix',
  'dubstep',
  'edm',
  'lofi',
  'lo-fi',
  'slowed',
  'reverb',
  '8d',
  'mashup',
  'nightcore',
  'bass boosted',
  'phonk',
  'trap',
  'instrumental',
  'karaoke',
  'cover',
  'unplugged',
  'acoustic',
  'reprise',
  'jhankar',
  'jhankar beats',
];

const normalize = (str: string | undefined | null): string => (str || '').toLowerCase().trim();

const cleanTitle = (name: string): string => {
  return normalize(name)
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(
      /\s*-\s*(from|feat|ft|remix|unplugged|reprise|acoustic|lofi|slowed|reverb|version|male|female|duet|sad|happy|jhankar|remastered|deluxe).*$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
};

const hasVariantTag = (name: string): boolean => {
  const lower = normalize(name);
  return VARIANT_TAGS.some((tag) => {
    const pattern = new RegExp(`\\b${tag}\\b|[\\(\\[]\\s*${tag}`, 'i');
    return pattern.test(lower);
  });
};

const dedupKey = (name: string, artist: string): string =>
  `${cleanTitle(name)}::${normalize(artist)}`;

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

const normalizePlayCount = (playCount: number): number => {
  if (!playCount || playCount <= 0) return 0;
  return Math.min(Math.log10(playCount) / 9, 1);
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

const getSongVibeVector = (entry: SongEntry) => {
  const dur = entry.duration || 0;
  const isUpbeatPaced =
    (dur > 0 && dur < 240) || entry.isVariant || (entry.singers || []).length >= 3;
  const isSlowBallad = !isUpbeatPaced;
  return { isUpbeatPaced, isSlowBallad, isVariant: entry.isVariant };
};

const scoreSong = (candidate: SongEntry, baseSong: SongEntry, coWeight = 0): number => {
  let score = 0;
  if (coWeight > 0) score += Math.min(coWeight * 20, 70);
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

  const baseVector = getSongVibeVector(baseSong);
  const candVector = getSongVibeVector(candidate);
  if (baseVector.isUpbeatPaced && candVector.isUpbeatPaced) score += 20;
  else if (baseVector.isSlowBallad && candVector.isSlowBallad) score += 20;
  else score -= 55;

  if (candidate.duration > 0 && baseSong.duration > 0) {
    const durationDiff = Math.abs(candidate.duration - baseSong.duration);
    if (durationDiff <= 30) score += 8;
    else if (durationDiff <= 60) score += 4;
  }

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

const diversifyScored = (scored: ScoredItem[], limit: number): string[] => {
  const seenNames = new Set<string>();
  const singerBuckets = new Map<string, string[]>();

  for (const item of scored) {
    const nameKey = cleanTitle(item.name);
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);

    const topSinger = item.topSinger || 'unknown';
    if (!singerBuckets.has(topSinger)) singerBuckets.set(topSinger, []);
    const bucket = singerBuckets.get(topSinger)!;
    if (bucket.length < 4) bucket.push(item.songId);
  }

  const result: string[] = [];
  const maxBucketLength = Math.max(0, ...[...singerBuckets.values()].map((b) => b.length));

  for (let i = 0; i < maxBucketLength; i++) {
    for (const [, bucket] of singerBuckets.entries()) {
      if (result.length >= limit) break;
      if (bucket[i]) result.push(bucket[i]!);
    }
    if (result.length >= limit) break;
  }

  return result;
};

const computeForSong = async (baseSongId: string): Promise<string[]> => {
  const baseSongRow = (await Song.findOne({
    where: { songId: baseSongId },
    attributes: [...SONG_ATTRS],
    raw: true,
  })) as unknown as SongRow | null;
  if (!baseSongRow) return [];

  const baseSong = buildEntry(baseSongRow);
  const candidateMap = new Map<string, { songRow: SongRow; coWeight: number }>();

  const coCandidates = await getCoOccurrenceCandidates(baseSongRow.id);
  for (const item of coCandidates) {
    if (item.song.songId !== baseSongId) {
      candidateMap.set(item.song.songId, { songRow: item.song, coWeight: item.coWeight });
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

  for (const { songRow, coWeight } of candidateMap.values()) {
    const entry = buildEntry(songRow);
    const dk = dedupKey(entry.name, entry.singers[0] || 'unknown');
    if (seen.has(dk)) continue;
    seen.add(dk);

    const score = scoreSong(entry, baseSong, coWeight);
    if (score < MIN_SCORE_THRESHOLD) continue;

    scored.push({
      songId: entry.songId,
      score,
      name: entry.name,
      topSinger: entry.singers[0] || 'unknown',
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return diversifyScored(scored, 100);
};

const deduplicateExternal = (
  songs: Array<Record<string, unknown>>
): Array<Record<string, unknown>> => {
  const seen = new Set<string>();
  return songs.filter((s) => {
    const artistMap = s.artist_map as Record<string, unknown> | undefined;
    const primaryArtists = artistMap?.primary_artists as Array<{ name?: string }> | undefined;
    const key = dedupKey((s.name as string) || '', primaryArtists?.[0]?.name || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fetchExternalRecommendations = async (
  songId: string
): Promise<Array<Record<string, unknown>>> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${SONG_API_URL}/song/recommend?id=${songId}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return [];
    const json = (await response.json()) as Record<string, unknown>;
    const data = (json?.data as Array<Record<string, unknown>>) || [];
    const valid = data.filter((s) => s?.id && (s?.download_url as unknown[])?.length > 0);
    return deduplicateExternal(valid);
  } catch {
    return [];
  }
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
  const external = await fetchExternalRecommendations(baseSongId);
  if (external && external.length > 0) {
    const excludeSet = new Set(excludeSongIds);
    const filtered = external.filter((s) => !excludeSet.has(s.id as string));
    if (filtered.length > 0) return filtered.slice(0, limit);
  }

  let cachedIds = await cache.get<string[]>(`${CACHE_PREFIX}${baseSongId}`);

  if (!cachedIds) {
    cachedIds = await computeForSong(baseSongId);
    if (cachedIds.length > 0) {
      await cache.set(`${CACHE_PREFIX}${baseSongId}`, cachedIds, CACHE_TTL);
    }
  }

  if (!cachedIds || cachedIds.length === 0) return [];

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
          await cache.set(`${CACHE_PREFIX}${songId}`, ids, CACHE_TTL);
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
  await cache.del(`${CACHE_PREFIX}${songId}`);
};
