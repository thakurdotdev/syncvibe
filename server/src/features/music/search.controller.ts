import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Song } from '@/models/index';
import sequelize from '@/utils/sequelize';
import { boundedInt } from '@/utils/helpers';

const SONG_API_URL = process.env.SONG_API_URL || 'https://song.thakur.dev';

const EXTERNAL_TIMEOUT_MS = 8_000;
const MAX_QUERY_LENGTH = 100;
/** How alike a song's name, artists or album must be to the query. */
const MIN_SIMILARITY = 0.15;

/**
 * `%` is `similarity() >= pg_trgm.similarity_threshold`, and unlike calling `similarity()` it can
 * use the trigram indexes instead of reading the whole catalog. The threshold is set for this
 * transaction only.
 */
const searchCatalog = (q: string, limit: number, offset: number) =>
  sequelize.transaction(async (transaction) => {
    await sequelize.query(`SET LOCAL pg_trgm.similarity_threshold = ${MIN_SIMILARITY}`, {
      transaction,
    });
    const term = sequelize.escape(q);
    const columns = ['"Song"."name"', '"Song"."artistNames"', '"Song"."albumName"'];
    const score = sequelize.literal(
      `GREATEST(${columns.map((column) => `similarity(${column}, ${term})`).join(', ')})`
    );
    return Song.findAll({
      where: { [Op.or]: columns.map((column) => sequelize.literal(`${column} % ${term}`)) },
      order: [[score, 'DESC']],
      limit,
      offset,
      attributes: { include: [[score, 'similarityScore']] },
      transaction,
    });
  });

async function fetchExternalSearch(
  query: string,
  limit = 30
): Promise<Array<Record<string, unknown>>> {
  try {
    const url = `${SONG_API_URL}/search/songs?q=${encodeURIComponent(query)}&limit=${limit}`;
    // Results from our own catalog shouldn't wait long on a slow song API.
    const response = await fetch(url, { signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as Record<string, unknown>;
    return (
      ((data?.data as Record<string, unknown>)?.results as Array<Record<string, unknown>>) || []
    );
  } catch (err) {
    console.error('[SearchController] External search failed:', (err as Error).message);
    return [];
  }
}

function computeRelevanceScore(song: Record<string, unknown>, query: string): number {
  const q = query.toLowerCase();
  const name = ((song.name as string) || '').toLowerCase();
  const artistMap = song.artist_map as Record<string, unknown> | undefined;
  const artists = (artistMap?.artists as Array<{ name?: string }>) || [];
  const artist = artists
    .map((a) => a.name)
    .join(' ')
    .toLowerCase();
  const album = ((song.album as string) || '').toLowerCase();

  const exactName = name === q ? 1.0 : 0;
  const startsWithName = name.startsWith(q) ? 0.5 : 0;
  const includesName = name.includes(q) ? 0.3 : 0;
  const includesArtist = artist.includes(q) ? 0.25 : 0;
  const includesAlbum = album.includes(q) ? 0.15 : 0;

  const words = q.split(/\s+/);
  const wordMatchRatio =
    words.length > 1
      ? words.filter((w) => name.includes(w) || artist.includes(w)).length / words.length
      : 0;

  return Math.min(
    exactName +
      startsWithName +
      includesName +
      includesArtist +
      includesAlbum +
      wordMatchRatio * 0.4,
    1.0
  );
}

export const searchSongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = typeof req.query.q === 'string' ? req.query.q.slice(0, MAX_QUERY_LENGTH) : '';
    const searchLimit = boundedInt(req.query.limit, 20, 50);
    const page = boundedInt(req.query.page, 1, 100);

    if (!raw.trim()) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const query = raw;
    const offset = (page - 1) * searchLimit;
    const q = query.toLowerCase().trim();

    const [dbResults, externalResults] = await Promise.all([
      searchCatalog(q, searchLimit, offset),
      fetchExternalSearch(query, searchLimit),
    ]);

    const scoredMap = new Map<string, { song: unknown; score: number }>();

    for (const row of dbResults) {
      const score = parseFloat(String(row.get('similarityScore') || 0)) || 0;
      scoredMap.set(row.songId, { song: row.songData, score });
    }

    for (const song of externalResults) {
      const score = computeRelevanceScore(song, q);
      const existing = scoredMap.get(song.id as string);
      if (!existing || score > existing.score) {
        scoredMap.set(song.id as string, { song, score });
      }
    }

    const ranked = [...scoredMap.values()].sort((a, b) => b.score - a.score).slice(0, searchLimit);

    const newExternalSongs = externalResults.filter(
      (s) => !dbResults.some((r) => r.songId === s.id)
    );
    if (newExternalSongs.length > 0) {
      Song.bulkGetOrCreate(newExternalSongs).catch((err: Error) => {
        console.error('[SearchController] Background save failed:', err.message);
      });
    }

    res.status(200).json({
      status: 'success',
      data: { songs: ranked.map((r) => r.song), count: ranked.length },
    });
  } catch (error) {
    console.error('Error in searchSongs:', error);
    res.status(500).json({ error: 'Failed to search songs' });
  }
};
