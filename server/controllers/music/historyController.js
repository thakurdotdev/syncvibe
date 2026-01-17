const HistorySong = require("../../models/music/HistorySong")
const Song = require("../../models/music/Song")
const { Op } = require("sequelize")
const sequelize = require("../../utils/sequelize")

// Initialize associations
require("../../models/music/index")

const recommendationCache = new Map()
const userStatsCache = new Map()

/* =========================
   HISTORY INSERT / UPDATE
========================= */

const addToHistory = async (req, res) => {
  try {
    const { songData: rawSongData, playedTime = 0 } = req.body
    const userId = req.user.userid

    // Parse songData if it's a string
    const songData = typeof rawSongData === "string" ? JSON.parse(rawSongData) : rawSongData

    if (!songData?.id) {
      return res.status(400).json({ error: "Invalid song data" })
    }

    // Get or create song in central table
    const song = await Song.getOrCreate(songData)

    const completionRate = calculateCompletionRate(playedTime, songData.duration)

    const [historySong, created] = await HistorySong.findOrCreate({
      where: { userId, songRefId: song.id },
      defaults: {
        userId,
        songRefId: song.id,
        // Keep deprecated fields for backward compatibility during migration
        songId: songData.id,
        songName: song.name,
        artistNames: song.artistNames,
        songLanguage: song.language,
        songData,
        duration: song.duration,
        playedTime,
        timeOfDay: new Date().getHours(),
        deviceType: getDeviceType(req.headers["user-agent"]),
        completionRate,
        playedCount: 1,
        totalPlayTime: playedTime,
        lastPlayedAt: new Date(),
      },
    })

    if (!created) {
      await updateExistingSong(historySong, playedTime, completionRate)
    }

    updateRecommendationScore(userId, song.id).catch(console.error)

    res.json({ message: "History updated successfully" })
  } catch (error) {
    console.error("Error in addToHistory:", error)
    res.status(500).json({ error: "Failed to update history" })
  }
}

const batchAddToHistory = async (req, res) => {
  try {
    const { updates } = req.body
    const userId = req.user.userid

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Invalid updates data" })
    }

    const results = []

    for (const update of updates) {
      const { songId, position, songData, duration, timestamp } = update

      if (!songId || !songData) {
        results.push({ songId, status: "failed", error: "Invalid song data" })
        continue
      }

      try {
        // Get or create song in central table
        const song = await Song.getOrCreate(songData)

        const completionRate = calculateCompletionRate(position, duration || songData.duration)

        const [historySong, created] = await HistorySong.findOrCreate({
          where: { userId, songRefId: song.id },
          defaults: {
            userId,
            songRefId: song.id,
            // Keep deprecated fields for backward compatibility
            songId,
            songName: song.name,
            artistNames: song.artistNames,
            songLanguage: song.language,
            songData,
            duration: duration || song.duration,
            playedTime: position,
            timeOfDay: new Date(timestamp || Date.now()).getHours(),
            deviceType: getDeviceType(req.headers["user-agent"]),
            completionRate,
            playedCount: 1,
            totalPlayTime: position,
            lastPlayedAt: new Date(timestamp || Date.now()),
          },
        })

        if (!created) {
          await updateExistingSong(historySong, position, completionRate)
        }

        updateRecommendationScore(userId, song.id).catch(console.error)

        results.push({ songId, status: "success" })
      } catch (err) {
        console.error(err)
        results.push({ songId, status: "failed", error: "Database error" })
      }
    }

    res.json({
      message: "Batch history updated successfully",
      results,
      processed: results.length,
      successful: results.filter((r) => r.status === "success").length,
    })
  } catch (error) {
    console.error("Error in batchAddToHistory:", error)
    res.status(500).json({ error: "Failed to update history batch" })
  }
}

/* =========================
   PERSONALIZED RECOMMENDATIONS
========================= */

const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.userid
    const limit = parseInt(req.query.limit || 12)

    // Cache key for recommendations only
    const cacheKey = `recs:${userId}:${limit}`
    const cached = recommendationCache.get(cacheKey)

    // Get recommendations from cache or compute
    let recommendationSongs
    if (cached && cached.expiresAt > Date.now()) {
      recommendationSongs = cached.data
    } else {
      const recommendations = await calculateWeightedRecommendations(userId, limit)
      recommendationSongs = recommendations.map((r) => r.song?.songData || r.songData)

      // Cache only recommendations (complex query)
      recommendationCache.set(cacheKey, {
        expiresAt: Date.now() + 5 * 60 * 1000,
        data: recommendationSongs,
      })
    }

    // Always fetch recently played fresh - no cache (should reflect new additions)
    const recentlyPlayed = await HistorySong.findAll({
      where: { userId, songRefId: { [Op.ne]: null } },
      include: [
        {
          model: Song,
          as: "song",
          attributes: ["songData"],
          required: true,
        },
      ],
      order: [["lastPlayedAt", "DESC"]],
      limit: 15,
      attributes: ["id", "songRefId"],
    })

    res.status(200).json({
      success: true,
      data: {
        songs: recommendationSongs,
        recentlyPlayed: recentlyPlayed.map((r) => r.song?.songData),
      },
    })
  } catch (error) {
    console.error("Error in getPersonalizedRecommendations:", error)
    res.status(500).json({ error: "Failed to get recommendations" })
  }
}

const calculateWeightedRecommendations = async (userId, limit) => {
  const userStats = await getUserListeningStats(userId)

  return HistorySong.findAll({
    attributes: {
      include: [
        [
          HistorySong.sequelize.literal(`
            (
              "HistorySong"."playedCount" * 0.35 +
              ("HistorySong"."completionRate" / 100) * 0.2 +
              CASE WHEN "HistorySong"."likeStatus" = true THEN 0.15 ELSE 0 END +
              CASE
                WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '7 days' THEN 0.3
                WHEN "HistorySong"."lastPlayedAt" >= NOW() - INTERVAL '30 days' THEN 0.18
                ELSE 0.06
              END
            )
          `),
          "weightedScore",
        ],
      ],
    },
    include: [
      {
        model: Song,
        as: "song",
        attributes: ["songData", "language", "artistNames"],
        required: true,
      },
    ],
    where: {
      userId,
      songRefId: { [Op.ne]: null },
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
      [Op.or]: [
        { playedCount: { [Op.gt]: 1 } },
        { completionRate: { [Op.gt]: 50 } },
        { likeStatus: true },
      ],
    },
    order: [
      [HistorySong.sequelize.literal('"aiRecommendationScore"'), "DESC NULLS LAST"],
      [HistorySong.sequelize.literal('"weightedScore"'), "DESC"],
    ],
    limit,
  })
}

/* =========================
   SEARCH / HISTORY
========================= */

const getHistorySongs = async (req, res) => {
  try {
    const userId = req.user.userid
    const {
      page = 1,
      limit = 10,
      searchQuery,
      sortBy = "lastPlayedAt",
      sortOrder = "DESC",
    } = req.query

    const validSortFields = ["lastPlayedAt", "playedCount", "songName", "createdat"]
    const validSortOrders = ["ASC", "DESC"]
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : "lastPlayedAt"
    const safeSortOrder = validSortOrders.includes(sortOrder?.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC"

    const whereClause = { userId, songRefId: { [Op.ne]: null } }
    let includeOptions = {
      model: Song,
      as: "song",
      attributes: ["songData", "name", "artistNames"],
      required: true,
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().replace(/[%_]/g, "\\$&")
      includeOptions.where = {
        [Op.or]: [{ name: { [Op.iLike]: `%${q}%` } }, { artistNames: { [Op.iLike]: `%${q}%` } }],
      }
    }

    let order
    if (searchQuery && searchQuery.trim()) {
      order = [
        [
          sequelize.literal(`
            (
              "HistorySong"."playedCount" * 0.4 +
              ("HistorySong"."completionRate" / 100) * 0.3 +
              CASE WHEN "HistorySong"."likeStatus" = true THEN 0.3 ELSE 0 END
            )
          `),
          "DESC",
        ],
        ["lastPlayedAt", "DESC"],
      ]
    } else if (safeSortBy === "songName") {
      order = [[sequelize.literal('"song"."name"'), safeSortOrder]]
    } else {
      order = [[safeSortBy, safeSortOrder]]
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)

    const historySongs = await HistorySong.findAndCountAll({
      where: whereClause,
      include: [includeOptions],
      limit: parseInt(limit),
      offset,
      order,
      attributes: ["id", "songRefId", "playedCount", "likeStatus", "lastPlayedAt"],
      distinct: true,
      subQuery: false,
    })

    res.status(200).json({
      status: "success",
      data: {
        songs: historySongs.rows.map((r) => r.song?.songData),
        count: historySongs.count,
        currentPage: parseInt(page),
        totalPages: Math.ceil(historySongs.count / parseInt(limit)),
      },
    })
  } catch (error) {
    console.error("Error in getHistorySongs:", error)
    res.status(500).json({ error: "Failed to get history songs" })
  }
}

/* =========================
   LIKE + AI SCORE
========================= */

const updateLikeStatus = async (req, res) => {
  try {
    const userId = req.user.userid
    const { songId, liked } = req.body

    const historySong = await HistorySong.findOne({
      where: { userId, songId },
    })

    if (!historySong) {
      return res.status(404).json({ error: "Song not found in history" })
    }

    await historySong.update({ likeStatus: liked })

    res.json({ message: "Like status updated successfully" })
  } catch (error) {
    console.error("Error in updateLikeStatus:", error)
    res.status(500).json({ error: "Failed to update like status" })
  }
}

const updateRecommendationScore = async (userId, songId) => {
  try {
    const stats = await getUserListeningStats(userId)

    const song = await HistorySong.findOne({
      where: { userId, songRefId: songId },
      raw: true,
    })

    if (!song) return

    const score = calculateAlgorithmicScore(song, stats)

    await HistorySong.update(
      { aiRecommendationScore: score },
      { where: { userId, songRefId: songId } },
    )
  } catch (error) {
    console.error("Error updating recommendation score:", error)
  }
}

/* =========================
   HELPERS
========================= */

const getUserListeningStats = async (userId) => {
  // Check cache first
  const cached = userStatsCache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const languages = await HistorySong.findAll({
    attributes: ["songLanguage", [sequelize.fn("COUNT", sequelize.col("songId")), "count"]],
    where: {
      userId,
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    },
    group: ["songLanguage"],
    order: [[sequelize.literal("count"), "DESC"]],
    limit: 3,
    raw: true,
  })

  const artists = await HistorySong.findAll({
    attributes: ["artistNames", [sequelize.fn("SUM", sequelize.col("playedCount")), "plays"]],
    where: {
      userId,
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      },
    },
    group: ["artistNames"],
    order: [[sequelize.literal("plays"), "DESC"]],
    limit: 5,
    raw: true,
  })

  const stats = {
    preferredLanguages: languages.map((l) => l.songLanguage),
    preferredArtists: artists.flatMap((a) => a.artistNames.split(",").map((x) => x.trim())),
  }

  // Cache for 15 minutes
  userStatsCache.set(userId, {
    expiresAt: Date.now() + 15 * 60 * 1000,
    data: stats,
  })

  return stats
}

const calculateAlgorithmicScore = (song, stats) => {
  let score = 0.5

  if (stats.preferredLanguages.includes(song.songLanguage)) score += 0.15

  const songArtists = song.artistNames.split(",").map((a) => a.trim())
  if (songArtists.some((a) => stats.preferredArtists.includes(a))) score += 0.2

  if (song.playedCount > 5) score += 0.05
  if (song.completionRate > 80) score += 0.1
  if (song.likeStatus) score += 0.2

  return Math.min(score, 1).toFixed(2)
}

const extractArtistNames = (songData) => {
  const artists =
    songData?.artist_map?.artists ||
    songData?.artist_map?.primary_artists ||
    songData?.artists ||
    []

  if (!Array.isArray(artists)) return "Unknown"

  return (
    artists
      .map((a) => a?.name)
      .filter(Boolean)
      .slice(0, 4)
      .join(", ") || "Unknown"
  )
}

const calculateCompletionRate = (playedTime, duration) =>
  duration ? Math.min((playedTime / duration) * 100, 100) : 0

const getDeviceType = (ua) => (ua?.includes("Mobile") ? "mobile" : "desktop")

const updateExistingSong = async (song, playedTime, completionRate) => {
  await song.update({
    playedCount: song.playedCount + 1,
    playedTime,
    lastPlayedAt: new Date(),
    completionRate,
    totalPlayTime: (song.totalPlayTime || 0) + playedTime,
  })
}

/* =========================
   EXPORTS
========================= */

module.exports = {
  addToHistory,
  batchAddToHistory,
  getPersonalizedRecommendations,
  updateLikeStatus,
  getHistorySongs,
}
