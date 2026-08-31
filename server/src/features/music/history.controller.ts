import type { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';
import { HistorySong, Song } from '@/models/index';
import sequelize from '@/utils/sequelize';
import {
  getRecommendationsForUser,
  getRecentlyPlayed,
  queueUserForRecalc,
} from '@/features/music/services/recommendation.service';

const calculateCompletionRate = (playedTime: number, duration: number): number =>
  duration ? Math.min((playedTime / duration) * 100, 100) : 0;

const getDeviceType = (ua: string | undefined): string =>
  ua?.includes('Mobile') ? 'mobile' : 'desktop';

const HISTORY_SORT_COLUMNS: Record<string, string> = {
  relevance: 'search_score',
  lastPlayedAt: 'hs."lastPlayedAt"',
  songName: "LOWER(COALESCE(s.name, ''))",
  playedCount: 'hs."playedCount"',
  songLanguage: "LOWER(COALESCE(s.language, ''))",
};

export const addToHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { songData: rawSongData, playedTime = 0 } = req.body as {
      songData: unknown;
      playedTime?: number;
    };
    const userId = req.user!.userid;

    const songData =
      typeof rawSongData === 'string'
        ? (JSON.parse(rawSongData) as Record<string, unknown>)
        : (rawSongData as Record<string, unknown>);
    if (!songData?.id) {
      res.status(400).json({ error: 'Invalid song data' });
      return;
    }

    const song = await Song.getOrCreate(songData);

    const playedTimeInt = Math.round(Number(playedTime) || 0);
    const completionRate = calculateCompletionRate(playedTimeInt, song.duration ?? 0);
    await HistorySong.upsert({
      userId,
      songRefId: song.id,
      playedCount: 1,
      playedTime: playedTimeInt,
      totalPlayTime: playedTimeInt,
      completionRate,
      timeOfDay: String(new Date().getHours()),
      deviceType: getDeviceType(req.headers['user-agent']),
      lastPlayedAt: new Date(),
    });

    queueUserForRecalc(userId);
    res.json({ message: 'History updated successfully' });
  } catch (error) {
    console.error('Error in addToHistory:', error);
    res.status(500).json({ error: 'Failed to update history' });
  }
};

export const getPersonalizedRecommendations = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user!.userid;
    const limit = parseInt((req.query.limit as string) || '12', 10);

    const [recommendationSongs, recentlyPlayedSongs] = await Promise.all([
      getRecommendationsForUser(userId, limit),
      getRecentlyPlayed(userId, 15),
    ]);

    res.status(200).json({
      success: true,
      data: { songs: recommendationSongs, recentlyPlayed: recentlyPlayedSongs },
    });
  } catch (error) {
    console.error('Error in getPersonalizedRecommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
};

export const getHistorySongs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userid;
    const parsedPage = Number.parseInt(req.query.page as string, 10);
    const parsedLimit = Number.parseInt(req.query.limit as string, 10);
    const pageNum = Number.isFinite(parsedPage) ? Math.max(parsedPage, 1) : 1;
    const limitNum = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 15;
    const searchQuery = (req.query.searchQuery as string)?.trim() || '';
    const requestedSortBy = (req.query.sortBy as string) || 'lastPlayedAt';
    const sortOrder = String(req.query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (pageNum - 1) * limitNum;

    const replacements: Record<string, unknown> = { userId, limit: limitNum, offset };
    let query: string;

    if (searchQuery.length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const searchPrefix = `${q.replace(/[%_\\]/g, '\\$&')}%`;
      const searchLike = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
      const searchRegex = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const words = q.split(/\s+/).filter(Boolean);

      const wordClauses = words.map(
        (_, i) => `LOWER(CONCAT_WS(' ', s.name, s."artistNames", s."albumName")) LIKE :word_${i}`
      );
      const wordReplacements: Record<string, string> = {};
      words.forEach((w, i) => {
        wordReplacements[`word_${i}`] = `%${w.replace(/[%_\\]/g, '\\$&')}%`;
      });

      Object.assign(replacements, {
        search: q,
        searchPrefix,
        searchLike,
        searchRegex,
        ...wordReplacements,
      });

      let searchOrderBy = 'search_score DESC, hs."lastPlayedAt" DESC, hs."songRefId" ASC';
      if (
        requestedSortBy === 'playedCount' ||
        requestedSortBy === 'songName' ||
        requestedSortBy === 'songLanguage'
      ) {
        const col = HISTORY_SORT_COLUMNS[requestedSortBy];
        searchOrderBy = `${col} ${sortOrder}, search_score DESC, hs."lastPlayedAt" DESC, hs."songRefId" ASC`;
      }

      query = `
        SELECT
          s."songData",
          COUNT(*) OVER() AS total_count,
          (
            -- 1. Exact song name match
            CASE WHEN LOWER(COALESCE(s.name, '')) = :search THEN 1000.0 ELSE 0 END
            -- 2. Whole word in song name
            + CASE WHEN LOWER(COALESCE(s.name, '')) ~ ('\\y' || :searchRegex || '\\y') THEN 400.0 ELSE 0 END
            -- 3. Song name starts with query
            + CASE WHEN LOWER(COALESCE(s.name, '')) LIKE :searchPrefix THEN 300.0 ELSE 0 END
            -- 4. Song name contains query
            + CASE WHEN LOWER(COALESCE(s.name, '')) LIKE :searchLike THEN 150.0 ELSE 0 END
            -- 5. Exact artist match
            + CASE WHEN LOWER(COALESCE(s."artistNames", '')) = :search THEN 300.0 ELSE 0 END
            -- 6. Whole word in artist name
            + CASE WHEN LOWER(COALESCE(s."artistNames", '')) ~ ('\\y' || :searchRegex || '\\y') THEN 150.0 ELSE 0 END
            -- 7. Artist starts with
            + CASE WHEN LOWER(COALESCE(s."artistNames", '')) LIKE :searchPrefix THEN 100.0 ELSE 0 END
            -- 8. Artist contains
            + CASE WHEN LOWER(COALESCE(s."artistNames", '')) LIKE :searchLike THEN 50.0 ELSE 0 END
            -- 9. Exact album match
            + CASE WHEN LOWER(COALESCE(s."albumName", '')) = :search THEN 150.0 ELSE 0 END
            -- 10. Whole word in album name
            + CASE WHEN LOWER(COALESCE(s."albumName", '')) ~ ('\\y' || :searchRegex || '\\y') THEN 80.0 ELSE 0 END
            -- 11. Album starts with
            + CASE WHEN LOWER(COALESCE(s."albumName", '')) LIKE :searchPrefix THEN 50.0 ELSE 0 END
            -- 12. Album contains
            + CASE WHEN LOWER(COALESCE(s."albumName", '')) LIKE :searchLike THEN 30.0 ELSE 0 END
            -- 13. Multi-word all words match bonus
            + CASE WHEN ${wordClauses.length > 1 ? `(${wordClauses.join(' AND ')})` : 'FALSE'} THEN 60.0 ELSE 0 END
            -- 14. Trigram similarity boost on name
            + (similarity(COALESCE(s.name, ''), :search) * 100.0)
            -- 15. Trigram similarity boost on artists
            + (similarity(COALESCE(s."artistNames", ''), :search) * 40.0)
            -- 16. Trigram similarity boost on album
            + (similarity(COALESCE(s."albumName", ''), :search) * 20.0)
          ) AS search_score
        FROM history_songs hs
        INNER JOIN songs s ON s.id = hs."songRefId"
        WHERE hs."userId" = :userId
          AND hs."songRefId" IS NOT NULL
          AND (
            LOWER(COALESCE(s.name, '')) LIKE :searchLike
            OR LOWER(COALESCE(s."artistNames", '')) LIKE :searchLike
            OR LOWER(COALESCE(s."albumName", '')) LIKE :searchLike
            ${wordClauses.length > 0 ? `OR (${wordClauses.join(' AND ')})` : ''}
            OR COALESCE(s.name, '') % :search
            OR COALESCE(s."artistNames", '') % :search
            OR COALESCE(s."albumName", '') % :search
          )
        ORDER BY ${searchOrderBy}
        LIMIT :limit OFFSET :offset
      `;
    } else {
      const sortBy = HISTORY_SORT_COLUMNS[requestedSortBy] ? requestedSortBy : 'lastPlayedAt';
      const orderBy = `${HISTORY_SORT_COLUMNS[sortBy]} ${sortOrder}, hs."lastPlayedAt" DESC, hs."songRefId" ASC`;
      query = `
        SELECT 
          s."songData",
          COUNT(*) OVER() AS total_count
        FROM history_songs hs
        INNER JOIN songs s ON s.id = hs."songRefId"
        WHERE hs."userId" = :userId AND hs."songRefId" IS NOT NULL
        ORDER BY ${orderBy}
        LIMIT :limit OFFSET :offset
      `;
    }

    const results = (await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT,
    })) as Array<{ songData: unknown; total_count: string }>;

    const totalCount = parseInt(results[0]?.total_count ?? '0', 10);

    res.status(200).json({
      status: 'success',
      data: {
        songs: results.map((r) => r.songData),
        count: totalCount,
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    console.error('Error in getHistorySongs:', error);
    res.status(500).json({ error: 'Failed to get history songs' });
  }
};
