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
    const pageNum = parseInt(req.query.page as string, 10) || 1;
    const limitNum = parseInt(req.query.limit as string, 10) || 10;
    const searchQuery = (req.query.searchQuery as string)?.trim() || '';
    const offset = (pageNum - 1) * limitNum;

    const replacements: Record<string, unknown> = { userId, limit: limitNum, offset };
    let query: string;

    if (searchQuery) {
      query = `
        WITH matched_songs AS (
          SELECT id, "songData",
            GREATEST(
              similarity(name, :search),
              similarity("artistNames", :search),
              similarity("albumName", :search)
            ) AS score
          FROM songs
          WHERE name % :search
             OR "artistNames" % :search
             OR "albumName" % :search
        )
        SELECT 
          s."songData",
          COUNT(*) OVER() AS total_count
        FROM history_songs hs
        INNER JOIN matched_songs s ON s.id = hs."songRefId"
        WHERE hs."userId" = :userId
        ORDER BY s.score DESC, hs."lastPlayedAt" DESC
        LIMIT :limit OFFSET :offset
      `;
      replacements.search = searchQuery.toLowerCase();
    } else {
      query = `
        SELECT 
          s."songData",
          COUNT(*) OVER() AS total_count
        FROM history_songs hs
        INNER JOIN songs s ON s.id = hs."songRefId"
        WHERE hs."userId" = :userId AND hs."songRefId" IS NOT NULL
        ORDER BY hs."lastPlayedAt" DESC
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
