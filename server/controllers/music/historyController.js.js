const HistorySong = require("../../models/music/HistorySong");
const { Op } = require("sequelize");
const MusicAIAgent = require("./AiAgent");
const sequelize = require("../../utils/sequelize");
const { Op } = require("sequelize");

const aiAgent = new MusicAIAgent(process.env.GEMINI_API_KEY);

// Cache configuration
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const recommendationCache = new Map();

const addToHistory = async (req, res) => {
  try {
    const { songData, playedTime = 0, isSameSong } = req.body;
    const userId = req.user.userid;

    if (!songData?.id) {
      return res.status(400).json({ error: "Invalid song data" });
    }

    const artistNames = extractArtistNames(songData);
    const completionRate = calculateCompletionRate(
      playedTime,
      songData.duration,
    );

    const [historySong, created] = await HistorySong.findOrCreate({
      where: { userId, songId: songData.id },
      defaults: {
        userId,
        songId: songData.id,
        songName: songData.name || songData.title || "Unknown",
        artistNames,
        songLanguage: songData.language || "Unknown",
        songData,
        duration: songData.duration,
        playedTime,
        timeOfDay: new Date().getHours(),
        deviceType: getDeviceType(req.headers["user-agent"]),
        completionRate,
      },
    });

    if (!created) {
      await updateExistingSong(
        historySong,
        playedTime,
        completionRate,
        isSameSong,
      );
    }

    clearUserCache(userId);

    updateAIScore(userId, songData.id).catch(console.error);

    res.json({ message: "History updated successfully", historySong });
  } catch (error) {
    console.error("Error in addToHistory:", error);
    res.status(500).json({ error: "Failed to update history" });
  }
};

const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.userid;
    const { limit = 12 } = req.query;

    const cacheKey = `recommendations:${userId}`;
    const cachedRecommendations = recommendationCache.get(cacheKey);

    console.log(Date.now() - cachedRecommendations?.timestamp, CACHE_TTL);

    if (
      cachedRecommendations &&
      Date.now() - cachedRecommendations.timestamp < CACHE_TTL
    ) {
      return res.json(cachedRecommendations.data);
    }

    const recentHistory = await getOptimizedUserHistory(userId);

    const weightedRecommendations = await calculateWeightedRecommendations(
      userId,
      limit,
      recentHistory,
    );

    const response = {
      songs: weightedRecommendations,
    };

    recommendationCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });

    res.json(response);
  } catch (error) {
    console.error("Error in getPersonalizedRecommendations:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
};

// Helper functions
const extractArtistNames = (songData) => {
  const artists =
    songData?.artist_map?.artists ||
    songData?.artist_map?.primary_artists ||
    [];
  return (
    artists
      .slice(0, 3)
      .map((artist) => artist.name)
      .join(", ") || "Unknown"
  );
};

const calculateCompletionRate = (playedTime, duration) => {
  return duration ? Math.min((playedTime / duration) * 100, 100) : 0;
};

const getDeviceType = (userAgent) => {
  return userAgent?.includes("Mobile") ? "mobile" : "desktop";
};

const updateExistingSong = async (
  historySong,
  playedTime,
  completionRate,
  isSameSong,
) => {
  await historySong.update({
    playedCount: !isSameSong
      ? historySong.playedCount + 1
      : historySong.playedCount,
    playedTime,
    lastPlayedAt: new Date(),
    completionRate,
    totalPlayTime: historySong.totalPlayTime + playedTime,
  });
};

const getOptimizedUserHistory = async (userId) => {
  return await HistorySong.findAll({
    attributes: [
      "songId",
      "artistNames",
      "songLanguage",
      "playedCount",
      "lastPlayedAt",
      "likeStatus",
      "tags",
      "mood",
      "completionRate",
      "aiRecommendationScore",
      "totalPlayTime",
    ],
    where: {
      userId,
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    order: [["lastPlayedAt", "DESC"]],
    limit: 50,
  });
};

const calculateWeightedRecommendations = async (userId, limit, history) => {
  const weights = {
    playCount: 0.3,
    aiScore: 0.3,
    recency: 0.2,
    completion: 0.2,
  };

  return await HistorySong.findAll({
    attributes: {
      include: [
        [
          HistorySong.sequelize.literal(`
            ("HistorySong"."playedCount" * ${weights.playCount} + 
            COALESCE("HistorySong"."aiRecommendationScore", 0) * ${
              weights.aiScore
            } +
            CASE 
              WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '7 days' THEN ${
                weights.recency
              }
              WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '30 days' THEN ${
                weights.recency * 0.5
              }
              ELSE 0
            END +
            ("HistorySong"."completionRate" / 100) * ${weights.completion})
          `),
          "weightedScore",
        ],
      ],
    },
    where: {
      userId,
      [Op.or]: [
        { playedCount: { [Op.gt]: 1 } },
        { aiRecommendationScore: { [Op.gt]: 0.5 } },
      ],
    },
    order: [[HistorySong.sequelize.literal('"weightedScore"'), "DESC"]],
    limit: parseInt(limit),
  });
};

const clearUserCache = (userId) => {
  const cacheKey = `recommendations:${userId}`;
  recommendationCache.delete(cacheKey);
};

const updateLikeStatus = async (req, res) => {
  try {
    const userId = req.user.userid;
    const { songId, liked } = req.body;

    const historySong = await HistorySong.findOne({
      where: { userId, songId },
    });

    if (!historySong) {
      return res.status(404).json({ error: "Song not found in history" });
    }

    await historySong.update({ likeStatus: liked });

    res.json({ message: "Like status updated successfully" });
  } catch (error) {
    console.error("Error in updateLikeStatus:", error);
    res.status(500).json({ error: "Failed to update like status" });
  }
};

const updateAIScore = async (userId, songId) => {
  try {
    const history = await HistorySong.findAll({
      where: { userId },
      attributes: [
        "songId",
        "artistNames",
        "songLanguage",
        "playedCount",
        "lastPlayedAt",
        "likeStatus",
        "tags",
        "mood",
        "completionRate",
      ],
      order: [["lastPlayedAt", "DESC"]],
      limit: 50,
      raw: true,
    });

    if (!history || history.length === 0) {
      console.warn(`No listening history found for user ${userId}.`);
      return;
    }

    const analysis = await aiAgent.analyzeListeningPatterns(history);
    console.log("AI Analysis Result:", analysis);

    const targetSong = history.find((item) => item.songId === songId);
    if (!targetSong) {
      console.warn(`Song ${songId} not found in user's history.`);
      return;
    }

    const score = calculateRecommendationScore(analysis, targetSong);

    console.log(
      `Calculated AI Recommendation Score for song ${songId}:`,
      score,
    );

    if (score === 0.5) {
      console.info(`Score unchanged for song ${songId}, skipping update.`);
      return;
    }

    await HistorySong.update(
      { aiRecommendationScore: score },
      { where: { userId, songId } },
    );

    console.info(
      `AI Recommendation Score updated successfully for song ${songId}.`,
    );
  } catch (error) {
    console.error("Error updating AI score:", error);
  }
};

const calculateRecommendationScore = (analysis, song) => {
  let score = 0.5;

  if (analysis.preferredLanguages.includes(song.songLanguage)) {
    score += 0.2;
  }

  if (
    analysis.preferredArtists.some((artist) =>
      song.artistNames.split(",").includes(artist),
    )
  ) {
    score += 0.2;
  }

  if (song.playedCount > 5) {
    score += 0.1;
  }

  if (new Date(song.lastPlayedAt) >= Date.now() - 7 * 24 * 60 * 60 * 1000) {
    score += 0.1;
  }

  return Math.min(score, 1).toFixed(2);
};

const getHistorySongs = async (req, res) => {
  try {
    const userId = req.user.userid;
    const { page = 1, limit = 10, searchQuery } = req.query;

    const whereClause = { userId };

    if (searchQuery) {
      whereClause.songName = {
        [Op.like]: `%${searchQuery}%`,
      };
    }

    const offset = (page - 1) * limit;

    const historySongs = await HistorySong.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["lastPlayedAt", "DESC"]],
      attributes: ["songId", "songData"],
      raw: true,
    });

    const updatedSongs = historySongs.rows.map((song) => song.songData);

    res.status(200).json({
      status: "success",
      data: {
        songs: updatedSongs,
        count: historySongs.count,
        currentPage: page,
        totalPages: Math.ceil(historySongs.count / limit),
      },
    });
  } catch (error) {
    console.error("Error in getHistorySongs:", error);
    res.status(500).json({ error: "Failed to get history songs" });
  }
};

module.exports = {
  addToHistory,
  getPersonalizedRecommendations,
  updateLikeStatus,
  getHistorySongs,
};
