const HistorySong = require("../../models/music/HistorySong")
const Song = require("../../models/music/Song")
const { Op } = require("sequelize")
const sequelize = require("../../utils/sequelize")

require("../../models/music/index")

const recommendationCache = new Map()

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

    const cacheKey = `recs:${userId}:${limit}`
    const cached = recommendationCache.get(cacheKey)

    let recommendationSongs
    if (cached && cached.expiresAt > Date.now()) {
      recommendationSongs = cached.data
    } else {
      const rows = await calculateWeightedRecommendations(userId, limit)
      recommendationSongs = rows.map((r) => r.song?.songData)

      recommendationCache.set(cacheKey, {
        expiresAt: Date.now() + 5 * 60 * 1000,
        data: recommendationSongs,
      })
    }

    const recentlyPlayed = await HistorySong.findAll({
      where: { userId, songRefId: { [Op.ne]: null } },
      include: [{ model: Song, as: "song", attributes: ["songData"], required: true }],
      order: [["lastPlayedAt", "DESC"]],
      limit: 15,
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
  const { artists, languages } = await getRecentContext(userId)

  const artistLikes = artists.map((a) => `%${a}%`)
  const languageList = languages.map((l) => sequelize.escape(l)).join(",")

  return HistorySong.findAll({
    include: [
      {
        model: Song,
        as: "song",
        attributes: ["songData", "artistNames", "language"],
        required: true,
      },
    ],
    where: {
      userId,
      songRefId: { [Op.ne]: null },
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    order: [
      [
        sequelize.literal(`
          (
            -- 🔥 STRONG RECENCY
            EXP(-EXTRACT(HOUR FROM NOW() - "HistorySong"."lastPlayedAt") / 24) * 0.45 +

            -- 🎧 ARTIST CONTEXT
            CASE
              WHEN "song"."artistNames" ILIKE ANY (
                ARRAY[${artistLikes.map((a) => sequelize.escape(a)).join(",")}]
              )
              THEN 0.25
              ELSE 0
            END +

            -- 🌍 LANGUAGE CONTEXT
            CASE
              WHEN "song"."language" IN (${languageList || "NULL"})
              THEN 0.15
              ELSE 0
            END +

            -- ❤️ USER SIGNALS
            ("HistorySong"."completionRate" / 100) * 0.1 +
            CASE WHEN "HistorySong"."likeStatus" = true THEN 0.1 ELSE 0 END
          )
        `),
        "DESC",
      ],
    ],
    limit,
  })
}

const getHistorySongs = async (req, res) => {
  try {
    const userId = req.user.userid
    const { page = 1, limit = 10, searchQuery } = req.query

    const whereClause = { userId, songRefId: { [Op.ne]: null } }

    const includeOptions = {
      model: Song,
      as: "song",
      attributes: ["songData", "name", "artistNames"],
      required: true,
    }

    if (searchQuery?.trim()) {
      const q = searchQuery.toLowerCase().trim()
      includeOptions.where = {
        [Op.or]: [
          sequelize.literal(`similarity("song"."name", ${sequelize.escape(q)}) > 0.2`),
          sequelize.literal(`similarity("song"."artistNames", ${sequelize.escape(q)}) > 0.2`),
          sequelize.literal(`similarity("song"."albumName", ${sequelize.escape(q)}) > 0.2`),
        ],
      }
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10)

    const historySongs = await HistorySong.findAndCountAll({
      where: whereClause,
      include: [includeOptions],
      limit: parseInt(limit, 10),
      offset,
      order: [["lastPlayedAt", "DESC"]],
      distinct: true,
      subQuery: false,
    })

    res.status(200).json({
      status: "success",
      data: {
        songs: historySongs.rows.map((r) => r.song?.songData),
        count: historySongs.count,
        currentPage: parseInt(page, 10),
        totalPages: Math.ceil(historySongs.count / parseInt(limit, 10)),
      },
    })
  } catch (error) {
    console.error("Error in getHistorySongs:", error)
    res.status(500).json({ error: "Failed to get history songs" })
  }
}

const getRecentContext = async (userId) => {
  const recent = await HistorySong.findAll({
    where: {
      userId,
      lastPlayedAt: {
        [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000), // last 24h
      },
    },
    include: [
      {
        model: Song,
        as: "song",
        attributes: ["artistNames", "language"],
        required: true,
      },
    ],
    limit: 20,
  })

  const artists = new Set()
  const languages = new Set()

  for (const r of recent) {
    const artistNames = r.song?.artistNames
    if (artistNames) {
      artistNames.split(",").forEach((a) => {
        const name = a.trim()
        if (name) artists.add(name)
      })
    }

    if (r.song?.language) {
      languages.add(r.song.language)
    }
  }

  return {
    artists: [...artists],
    languages: [...languages],
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
