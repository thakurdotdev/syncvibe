const HistorySong = require("../../models/music/HistorySong")
const Song = require("../../models/music/Song")
const { Op } = require("sequelize")
const sequelize = require("../../utils/sequelize")
const {
  getRecommendationsForUser,
  getRecentlyPlayed,
  queueUserForRecalc,
} = require("../../services/recommendationService")

require("../../models/music/index")

const addToHistory = async (req, res) => {
  try {
    const { songData: rawSongData, playedTime = 0 } = req.body
    const userId = req.user.userid

    const songData = typeof rawSongData === "string" ? JSON.parse(rawSongData) : rawSongData
    if (!songData?.id) {
      return res.status(400).json({ error: "Invalid song data" })
    }

    const song = await Song.getOrCreate(songData)

    const completionRate = calculateCompletionRate(playedTime, song.duration)
    await HistorySong.upsert({
      userId,
      songRefId: song.id,

      playedCount: 1,
      playedTime,
      totalPlayTime: playedTime,
      completionRate,
      timeOfDay: new Date().getHours(),
      deviceType: getDeviceType(req.headers["user-agent"]),
      lastPlayedAt: new Date(),
    })

    queueUserForRecalc(userId)
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
      const { songId, position = 0, songData, duration, timestamp } = update

      if (!songId || !songData) {
        results.push({ songId, status: "failed", error: "Invalid song data" })
        continue
      }

      try {
        const song = await Song.getOrCreate(songData)
        const completionRate = calculateCompletionRate(position, duration || song.duration)

        await HistorySong.upsert({
          userId,
          songRefId: song.id,

          playedCount: 1,
          playedTime: position,
          totalPlayTime: position,
          completionRate,
          timeOfDay: new Date(timestamp || Date.now()).getHours(),
          deviceType: getDeviceType(req.headers["user-agent"]),
          lastPlayedAt: new Date(timestamp || Date.now()),
        })

        results.push({ songId, status: "success" })
      } catch (err) {
        console.error(err)
        results.push({ songId, status: "failed", error: "Database error" })
      }
    }

    queueUserForRecalc(userId)
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

const getPersonalizedRecommendations = async (req, res) => {
  try {
    const userId = req.user.userid
    const limit = parseInt(req.query.limit || 12, 10)

    const [recommendationSongs, recentlyPlayedSongs] = await Promise.all([
      getRecommendationsForUser(userId, limit),
      getRecentlyPlayed(userId, 15),
    ])

    res.status(200).json({
      success: true,
      data: {
        songs: recommendationSongs,
        recentlyPlayed: recentlyPlayedSongs,
      },
    })
  } catch (error) {
    console.error("Error in getPersonalizedRecommendations:", error)
    res.status(500).json({ error: "Failed to get recommendations" })
  }
}

const getHistorySongs = async (req, res) => {
  try {
    const userId = req.user.userid
    const pageNum = parseInt(req.query.page, 10) || 1
    const limitNum = parseInt(req.query.limit, 10) || 10
    const searchQuery = req.query.searchQuery?.trim() || ""
    const offset = (pageNum - 1) * limitNum

    let query
    let replacements = { userId, limit: limitNum, offset }

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
      `
      replacements.search = searchQuery.toLowerCase()
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
      `
    }

    const results = await sequelize.query(query, {
      replacements,
      type: sequelize.QueryTypes.SELECT,
    })

    const totalCount = results[0]?.total_count || 0

    res.status(200).json({
      status: "success",
      data: {
        songs: results.map((r) => r.songData),
        count: parseInt(totalCount, 10),
        currentPage: pageNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    })
  } catch (error) {
    console.error("Error in getHistorySongs:", error)
    res.status(500).json({ error: "Failed to get history songs" })
  }
}

const updateLikeStatus = async (req, res) => {
  try {
    const userId = req.user.userid
    const { songId, liked } = req.body

    const updated = await HistorySong.update({ likeStatus: liked }, { where: { userId, songId } })

    if (!updated[0]) {
      return res.status(404).json({ error: "Song not found in history" })
    }

    res.json({ message: "Like status updated successfully" })
  } catch (error) {
    console.error("Error in updateLikeStatus:", error)
    res.status(500).json({ error: "Failed to update like status" })
  }
}

const calculateCompletionRate = (playedTime, duration) =>
  duration ? Math.min((playedTime / duration) * 100, 100) : 0

const getDeviceType = (ua) => (ua?.includes("Mobile") ? "mobile" : "desktop")

module.exports = {
  addToHistory,
  batchAddToHistory,
  getPersonalizedRecommendations,
  updateLikeStatus,
  getHistorySongs,
}
