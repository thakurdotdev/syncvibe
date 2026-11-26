import { Op, QueryTypes } from 'sequelize';
import { Song, HistorySong } from '@/models/index';
import { cache } from '@/utils/redis';
import sequelize from '@/utils/sequelize';
import {
  cleanTitle,
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
import {
  personalizePlayNext,
  steerPlayNext,
  type PastListen,
  type Steer,
} from './play-next.personal';
import { loadProfile, loadSongFacts, type ListenerProfile } from './listener.service';
import { withoutBlockedArtists } from './artist-block.logic';
import { moodStation, songMoods } from './mood.service';
import { artistWeights, fuseRelated, pickSeeds } from './recommendation.scoring';

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
/** A room's taste is read from at most this many people, so a full room stays quick. */
const MAX_ROOM_LISTENERS = 8;
/** How many places a song by an artist everyone in the room loves moves up. */
const ROOM_FIT_POINTS = 8;

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
  /** Songs skipped quickly this session, which steer away from their artists. */
  skippedSongIds?: string[];
  /** Songs played to the end this session. */
  finishedSongIds?: string[];
  steer?: Steer | null;
}

/** How many candidates steering may reorder before the list is cut to size. */
const STEER_POOL = 60;
/** "Something different" starts from this many other sides of the listener's taste. */
const DIFFERENT_SEEDS = 3;
const DIFFERENT_PER_SINGER = 2;

const songDataFor = async (ids: string[]): Promise<Array<Record<string, unknown>>> => {
  if (ids.length === 0) return [];
  const songs = await Song.findAll({
    where: { songId: { [Op.in]: ids } },
    attributes: ['songId', 'songData'],
    raw: true,
  });
  const dataMap = new Map<string, Record<string, unknown>>();
  for (const s of songs) dataMap.set(s.songId, s.songData as Record<string, unknown>);
  return ids.map((id) => dataMap.get(id)).filter((d): d is Record<string, unknown> => !!d);
};

/** Reorders candidates by this session's skips and plays and what the listener asked for. */
const steer = async (
  baseSongId: string,
  candidateIds: string[],
  { skippedSongIds = [], finishedSongIds = [], steer: request = null }: PlayNextParams
): Promise<string[]> => {
  if (!request && skippedSongIds.length === 0 && finishedSongIds.length === 0) return candidateIds;
  const [facts, moods] = await Promise.all([
    loadSongFacts([baseSongId, ...candidateIds, ...skippedSongIds, ...finishedSongIds]),
    request?.startsWith('mood:')
      ? songMoods(candidateIds)
      : Promise.resolve(new Map<string, string>()),
  ]);
  const singerOf = (id: string) => normalize(facts.get(id)?.artist);
  const skippedArtists = new Map<string, number>();
  for (const id of skippedSongIds) {
    const singer = singerOf(id);
    if (singer) skippedArtists.set(singer, (skippedArtists.get(singer) ?? 0) + 1);
  }
  const base = facts.get(baseSongId);
  return steerPlayNext({
    candidates: candidateIds.map((songId) => ({
      songId,
      singer: singerOf(songId),
      album: normalize(facts.get(songId)?.album),
      mood: moods.get(songId) ?? null,
    })),
    baseSingers: new Set(base ? [normalize(base.artist)] : []),
    baseAlbum: normalize(base?.album),
    skippedArtists,
    finishedArtists: new Set(finishedSongIds.map(singerOf).filter(Boolean)),
    steer: request,
  });
};

/** Seeds from the parts of a listener's taste unlike this song, and songs related to them. */
const anotherSide = async (baseSongId: string, profile: ListenerProfile): Promise<string[]> => {
  const seeds = pickSeeds(profile.listens, new Date());
  const ids = [baseSongId, ...seeds.map((seed) => seed.songId)];
  const [facts, moods] = await Promise.all([loadSongFacts(ids), songMoods(ids)]);
  const base = facts.get(baseSongId);
  const kindOf = (id: string) => `${facts.get(id)?.language ?? ''}:${moods.get(id) ?? ''}`;
  const away = seeds
    .filter(
      (seed) =>
        kindOf(seed.songId) !== kindOf(baseSongId) &&
        normalize(facts.get(seed.songId)?.artist) !== normalize(base?.artist)
    )
    .slice(0, DIFFERENT_SEEDS);
  if (away.length === 0) return [];

  const relatedBySeed = new Map<string, string[]>();
  for (const seed of away) relatedBySeed.set(seed.songId, await getRelatedSongIds(seed.songId));
  const fused = fuseRelated(away, relatedBySeed, profile.known).slice(0, STEER_POOL);
  const fusedFacts = await loadSongFacts(fused.map((item) => item.songId));
  const perSinger = new Map<string, number>();
  return fused
    .map((item) => item.songId)
    .filter((id) => {
      const singer = normalize(fusedFacts.get(id)?.artist);
      const count = perSinger.get(singer) ?? 0;
      perSinger.set(singer, count + 1);
      return count < DIFFERENT_PER_SINGER;
    });
};

export const getPlayNextSongs = async (
  params: PlayNextParams
): Promise<Array<Record<string, unknown>>> => {
  const { baseSongId, userId = null, limit = 20, excludeSongIds = [], steer: request } = params;
  const cachedIds = await getRelatedSongIds(baseSongId);

  const excluded = new Set(excludeSongIds);
  let resultIds = cachedIds.filter((id) => !excluded.has(id));
  const profile = userId ? await loadProfile(userId) : null;

  if (profile && resultIds.length > 0) {
    const candidates = await Song.findAll({
      where: { songId: { [Op.in]: resultIds } },
      attributes: ['id', 'songId', 'name'],
      raw: true,
    });
    const nameById = new Map(candidates.map((song) => [song.songId, song.name || '']));
    resultIds = personalizePlayNext({
      candidates: resultIds.map((songId) => ({ songId, name: nameById.get(songId) ?? '' })),
      history: await getPastListens(profile.userId, candidates),
      dislikedIds: profile.dislikes.songIds,
      blockedTitles: profile.dislikes.titles,
      now: new Date(),
      limit: Math.max(limit, STEER_POOL),
    });
  }

  // "Something different" leaves this song's corner altogether: songs like another side of the
  // listener's taste, in a different language or mood from this one.
  if (request === 'different' && profile) {
    const elsewhere = await anotherSide(baseSongId, profile);
    if (elsewhere.length > 0) {
      resultIds = [...elsewhere.filter((id) => !excluded.has(id)), ...resultIds];
    }
  }

  resultIds = await steer(baseSongId, resultIds, params);

  // Asked for a mood the related songs barely have: the mood's station fills the rest.
  const moodKey = request?.startsWith('mood:') ? request.slice('mood:'.length) : null;
  if (moodKey) {
    const moods = await songMoods(resultIds);
    const matching = resultIds.filter((id) => moods.get(id) === moodKey);
    if (matching.length < limit) {
      const station = await moodStation(moodKey, profile, limit);
      const stationIds = station
        .map((song) => String(song.id))
        .filter((id) => id !== baseSongId && !excluded.has(id) && !matching.includes(id));
      resultIds = [...matching, ...stationIds];
    }
  }

  return songDataFor(resultIds.slice(0, limit));
};

/**
 * Autoplay for a room: songs like the one playing that suit the people in it. Anything one of
 * them disliked is left out, and songs by artists the room plays more move up.
 */
export const getPlayNextForRoom = async ({
  baseSongId,
  listenerIds,
  limit = 10,
  excludeSongIds = [],
}: {
  baseSongId: string;
  listenerIds: number[];
  limit?: number;
  excludeSongIds?: string[];
}): Promise<Array<Record<string, unknown>>> => {
  const excluded = new Set(excludeSongIds);
  const related = (await getRelatedSongIds(baseSongId)).filter((id) => !excluded.has(id));
  const listeners = listenerIds.slice(0, MAX_ROOM_LISTENERS);
  if (related.length === 0 || listeners.length === 0) return songDataFor(related.slice(0, limit));

  const profiles = await Promise.all(listeners.map((id) => loadProfile(id)));
  const facts = await loadSongFacts(related);
  const now = new Date();
  const affinities = profiles.map((profile) => artistWeights(profile.listens, now));
  const ranked = related
    .filter((id) =>
      profiles.every(
        (profile) =>
          !profile.dislikes.songIds.has(id) &&
          !profile.dislikes.titles.has(cleanTitle(facts.get(id)?.name ?? ''))
      )
    )
    .map((id, index) => {
      const singer = normalize(facts.get(id)?.artist);
      const fit =
        affinities.reduce((sum, weights) => sum + (weights.get(singer) ?? 0), 0) /
        affinities.length;
      return { id, value: -index + ROOM_FIT_POINTS * fit };
    })
    .sort((a, b) => b.value - a.value)
    .map((item) => item.id);
  // Nobody here gets an artist they blocked.
  const blocked = new Set(profiles.flatMap((profile) => [...profile.dislikes.artistIds]));
  if (blocked.size === 0) return songDataFor(ranked.slice(0, limit));
  return withoutBlockedArtists(await songDataFor(ranked.slice(0, limit * 2)), blocked).slice(
    0,
    limit
  );
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
