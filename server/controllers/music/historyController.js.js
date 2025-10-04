const HistorySong = require('../../models/music/HistorySong');
const { Op } = require('sequelize');
const sequelize = require('../../utils/sequelize');

const recommendationCache = new Map();

const addToHistory = async (req, res) => {
  try {
    const { songData, playedTime = 0 } = req.body;
    const userId = req.user.userid;

    if (!songData?.id) {
      return res.status(400).json({ error: 'Invalid song data' });
    }

    const artistNames = extractArtistNames(songData);
    const completionRate = calculateCompletionRate(playedTime, songData.duration);

    const [historySong, created] = await HistorySong.findOrCreate({
      where: { userId, songId: songData.id },
      defaults: {
        userId,
        songId: songData.id,
        songName: songData.name || songData.title || 'Unknown',
        artistNames,
        songLanguage: songData.language || 'Unknown',
        songData,
        duration: songData.duration,
        playedTime,
        timeOfDay: new Date().getHours(),
        deviceType: getDeviceType(req.headers['user-agent']),
        completionRate,
      },
    });

    if (!created) {
      await updateExistingSong(historySong, playedTime, completionRate);
    }

    // Calculate recommendation score algorithmically
    updateRecommendationScore(userId, songData.id).catch(console.error);

    res.json({ message: 'History updated successfully' });
  } catch (error) {
    console.error('Error in addToHistory:', error);
    res.status(500).json({ error: 'Failed to update history' });
  }
};

const batchAddToHistory = async (req, res) => {
  try {
    const { updates } = req.body;
    const userId = req.user.userid;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid updates data' });
    }

    const results = [];

    // Process each update in the batch
    for (const update of updates) {
      const { songId, position, songData, duration, timestamp } = update;

      if (!songId || !songData) {
        results.push({
          songId: songId || 'unknown',
          status: 'failed',
          error: 'Invalid song data',
        });
        continue;
      }

      try {
        const artistNames = extractArtistNames(songData);
        const completionRate = calculateCompletionRate(position, duration || songData.duration);

        const [historySong, created] = await HistorySong.findOrCreate({
          where: { userId, songId },
          defaults: {
            userId,
            songId,
            songName: songData.name || songData.title || 'Unknown',
            artistNames,
            songLanguage: songData.language || 'Unknown',
            songData,
            duration: duration || songData.duration,
            playedTime: position,
            timeOfDay: new Date(timestamp || Date.now()).getHours(),
            deviceType: getDeviceType(req.headers['user-agent']),
            completionRate,
            playedCount: 1,
            lastPlayed: new Date(timestamp || Date.now()),
          },
        });

        if (!created) {
          await updateExistingSong(historySong, position, completionRate);
        }

        // Calculate recommendation score algorithmically
        updateRecommendationScore(userId, songId).catch(console.error);

        results.push({
          songId,
          status: 'success',
        });
      } catch (error) {
        console.error(`Error processing song ${songId}:`, error);
        results.push({
          songId,
          status: 'failed',
          error: 'Database error',
        });
      }
    }

    res.json({
      message: 'Batch history updated successfully',
      results,
      processed: results.length,
      successful: results.filter((r) => r.status === 'success').length,
    });
  } catch (error) {
    console.error('Error in batchAddToHistory:', error);
    res.status(500).json({ error: 'Failed to update history batch' });
  }
};

const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.userid;
    const { limit = 12 } = req.query;

    const weightedRecommendations = await calculateWeightedRecommendations(userId, limit);

    const recentlyPlayed = await HistorySong.findAll({
      where: {
        userId,
      },
      order: [['lastPlayedAt', 'DESC']],
      limit: 15,
      attributes: ['songId', 'songData'],
      raw: true,
    });

    const recentSongs = recentlyPlayed.map((item) => item.songData);
    const recommendationSongs = weightedRecommendations.map((item) => item.songData);

    const response = {
      songs: recommendationSongs,
      recentlyPlayed: recentSongs,
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error in getPersonalizedRecommendations:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
};

// Helper functions
const extractArtistNames = (songData) => {
  const artists = songData?.artist_map?.artists || songData?.artist_map?.primary_artists || [];
  return (
    artists
      .slice(0, 3)
      .map((artist) => artist.name)
      .join(', ') || 'Unknown'
  );
};

const calculateCompletionRate = (playedTime, duration) => {
  return duration ? Math.min((playedTime / duration) * 100, 100) : 0;
};

const getDeviceType = (userAgent) => {
  return userAgent?.includes('Mobile') ? 'mobile' : 'desktop';
};

const updateExistingSong = async (historySong, playedTime, completionRate) => {
  await historySong.update({
    playedCount: playedTime < 20 ? historySong.playedCount + 1 : historySong.playedCount,
    playedTime,
    lastPlayedAt: new Date(),
    completionRate,
    totalPlayTime: historySong.totalPlayTime + playedTime,
  });
};

const calculateWeightedRecommendations = async (userId, limit) => {
  const weights = {
    playCount: 0.35,
    recency: 0.3,
    completion: 0.2,
    likeStatus: 0.15,
  };

  return await HistorySong.findAll({
    attributes: {
      include: [
        [
          HistorySong.sequelize.literal(`
            ("HistorySong"."playedCount" * ${weights.playCount} + 
            CASE 
              WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '2 days' THEN ${weights.recency}
              WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '7 days' THEN ${
                weights.recency * 0.8
              }
              WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '30 days' THEN ${
                weights.recency * 0.5
              }
              ELSE ${weights.recency * 0.2}
            END +
            ("HistorySong"."completionRate" / 100) * ${weights.completion} +
            CASE
              WHEN "HistorySong"."likeStatus" = true THEN ${weights.likeStatus}
              ELSE 0
            END)
          `),
          'weightedScore',
        ],
      ],
    },
    where: {
      userId,
      [Op.or]: [
        { playedCount: { [Op.gt]: 1 } },
        { completionRate: { [Op.gt]: 50 } },
        { likeStatus: true },
      ],
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      },
    },
    order: [[HistorySong.sequelize.literal('"weightedScore"'), 'DESC']],
    limit: parseInt(limit),
  });
};

const updateLikeStatus = async (req, res) => {
  try {
    const userId = req.user.userid;
    const { songId, liked } = req.body;

    const historySong = await HistorySong.findOne({
      where: { userId, songId },
    });

    if (!historySong) {
      return res.status(404).json({ error: 'Song not found in history' });
    }

    await historySong.update({ likeStatus: liked });

    res.json({ message: 'Like status updated successfully' });
  } catch (error) {
    console.error('Error in updateLikeStatus:', error);
    res.status(500).json({ error: 'Failed to update like status' });
  }
};

const updateRecommendationScore = async (userId, songId) => {
  try {
    // Get user's listening patterns and preferences
    const userStats = await getUserListeningStats(userId);

    // Get the target song
    const targetSong = await HistorySong.findOne({
      where: { userId, songId },
      raw: true,
    });

    if (!targetSong) {
      console.warn(`Song ${songId} not found in user's history.`);
      return;
    }

    // Calculate recommendation score based on statistics
    const score = calculateAlgorithmicScore(targetSong, userStats);

    // Only update if score is different from default
    if (score !== 0.5) {
      await HistorySong.update({ aiRecommendationScore: score }, { where: { userId, songId } });
    }
  } catch (error) {
    console.error('Error updating recommendation score:', error);
  }
};

// Get user's listening statistics
const getUserListeningStats = async (userId) => {
  // Get frequency of languages
  const languageStats = await HistorySong.findAll({
    attributes: ['songLanguage', [sequelize.fn('COUNT', sequelize.col('songId')), 'count']],
    where: {
      userId,
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      }, // Last 60 days
    },
    group: ['songLanguage'],
    order: [[sequelize.literal('count'), 'DESC']],
    raw: true,
  });

  // Get top artists
  const artistStats = await HistorySong.findAll({
    attributes: [
      'artistNames',
      [sequelize.fn('SUM', sequelize.col('playedCount')), 'totalPlays'],
      [sequelize.fn('COUNT', sequelize.col('songId')), 'songCount'],
    ],
    where: {
      userId,
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      }, // Last 60 days
    },
    group: ['artistNames'],
    order: [[sequelize.literal('totalPlays'), 'DESC']],
    limit: 10,
    raw: true,
  });

  return {
    preferredLanguages: languageStats.slice(0, 3).map((item) => item.songLanguage),
    preferredArtists: artistStats.slice(0, 5).map((item) => item.artistNames),
  };
};

const calculateAlgorithmicScore = (song, userStats) => {
  let score = 0.5; // Default value

  // Language preference
  if (userStats.preferredLanguages.includes(song.songLanguage)) {
    score += 0.2;
  }

  // Artist preference - check if any artist from the song matches user's preferred artists
  const songArtists = song.artistNames.split(',').map((a) => a.trim());
  for (const artist of songArtists) {
    if (userStats.preferredArtists.some((a) => a.includes(artist))) {
      score += 0.2;
      break;
    }
  }

  // Play count indicates popularity
  if (song.playedCount > 5) {
    score += 0.1;
  }

  // Recent plays are more relevant
  if (new Date(song.lastPlayedAt) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
    score += 0.1;
  }

  // Completion rate indicates user interest
  if (song.completionRate > 80) {
    score += 0.1;
  }

  // Like status is highly relevant
  if (song.likeStatus === true) {
    score += 0.2;
  }

  return Math.min(score, 1).toFixed(2);
};

const getHistorySongs = async (req, res) => {
  try {
    const userId = req.user.userid;
    const {
      page = 1,
      limit = 10,
      searchQuery,
      sortBy = 'lastPlayedAt',
      sortOrder = 'DESC',
    } = req.query;

    const whereClause = { userId };

    if (searchQuery) {
      whereClause.songName = {
        [Op.like]: `%${searchQuery}%`,
      };
    }

    const order = [[sortBy, sortOrder]];

    const offset = (page - 1) * limit;

    const historySongs = await HistorySong.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset,
      order,
      attributes: ['songId', 'songData'],
      raw: true,
    });

    const updatedSongs = historySongs.rows.map((song) => song.songData);

    res.status(200).json({
      status: 'success',
      data: {
        songs: updatedSongs,
        count: historySongs.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(historySongs.count / limit),
      },
    });
  } catch (error) {
    console.error('Error in getHistorySongs:', error);
    res.status(500).json({ error: 'Failed to get history songs' });
  }
};

module.exports = {
  addToHistory,
  batchAddToHistory,
  getPersonalizedRecommendations,
  updateLikeStatus,
  getHistorySongs,
};
