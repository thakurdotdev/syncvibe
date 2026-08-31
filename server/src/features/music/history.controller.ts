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
  lastPlayedAt: 'hs."lastPlayedAt"',
  songName: 'LOWER(COALESCE(s.name, \'\'))',
  playedCount: 'hs."playedCount"',
  songLanguage: 'LOWER(COALESCE(s.language, \'\'))',
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
    const searchQuery = (req.query.searchQuery as string)?.trim().toLowerCase() || '';
    const requestedSortBy = (req.query.sortBy as string) || 'lastPlayedAt';
    const sortBy = HISTORY_SORT_COLUMNS[requestedSortBy]
      ? requestedSortBy
      : 'lastPlayedAt';
    const sortOrder = String(req.query.sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const orderBy = `${HISTORY_SORT_COLUMNS[sortBy]} ${sortOrder}, hs."lastPlayedAt" DESC, hs."songRefId" ASC`;
    const offset = (pageNum - 1) * limitNum;

    const replacements: Record<string, unknown> = { userId, limit: limitNum, offset };
    let query: string;

    if (searchQuery.length >= 2) {
      query = `
        SELECT
          s."songData",
          COUNT(*) OVER() AS total_count,
          GREATEST(
            similarity(COALESCE(s.name, ''), :search),
            similarity(COALESCE(s."artistNames", ''), :search),
            similarity(COALESCE(s."albumName", ''), :search)
          ) AS search_score
        FROM history_songs hs
        INNER JOIN songs s ON s.id = hs."songRefId"
        WHERE hs."userId" = :userId
          AND hs."songRefId" IS NOT NULL
          AND (
            COALESCE(s.name, '') % :search
            OR COALESCE(s."artistNames", '') % :search
            OR COALESCE(s."albumName", '') % :search
          )
        ORDER BY ${orderBy}, search_score DESC
        LIMIT :limit OFFSET :offset
      `;
      replacements.search = searchQuery;
    } else {
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
