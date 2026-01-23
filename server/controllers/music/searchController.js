const Song = require("../../models/music/Song")
const { Op } = require("sequelize")
const sequelize = require("../../utils/sequelize")

const SONG_API_URL = process.env.SONG_API_URL || "https://song.thakur.dev"
const MIN_DB_RESULTS = 5

async function fetchExternalSearch(query, limit = 30) {
  try {
    const url = `${SONG_API_URL}/search/songs?q=${encodeURIComponent(query)}&limit=${limit}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    return data?.data?.results || []
  } catch (err) {
    console.error("[SearchController] External search failed:", err.message)
    return []
  }
}

const searchSongs = async (req, res) => {
  try {
    const { q: query, limit = 20, page = 1 } = req.query

    if (!query?.trim()) {
      return res.status(400).json({ error: "Search query is required" })
    }

    const searchLimit = parseInt(limit, 10)
    const offset = (parseInt(page, 10) - 1) * searchLimit
    const q = query.toLowerCase().trim()

    const dbResults = await Song.findAll({
      where: {
        [Op.or]: [
          sequelize.literal(`similarity("Song"."name", ${sequelize.escape(q)}) > 0.2`),
          sequelize.literal(`similarity("Song"."artistNames", ${sequelize.escape(q)}) > 0.2`),
          sequelize.literal(`similarity("Song"."albumName", ${sequelize.escape(q)}) > 0.2`),
        ],
      },
      order: [
        [
          sequelize.literal(`
            GREATEST(
              similarity("Song"."name", ${sequelize.escape(q)}),
              similarity("Song"."artistNames", ${sequelize.escape(q)}),
              similarity("Song"."albumName", ${sequelize.escape(q)})
            )
          `),
          "DESC",
        ],
      ],
      limit: searchLimit,
      offset,
      attributes: ["songData", "songId"],
    })

    const dbSongs = dbResults.map((r) => r.songData)
    const dbSongIds = new Set(dbResults.map((r) => r.songId))

    let externalSongs = []
    const needMoreResults = dbSongs.length < MIN_DB_RESULTS

    if (needMoreResults) {
      const externalResults = await fetchExternalSearch(query, searchLimit)
      externalSongs = externalResults.filter((song) => !dbSongIds.has(song.id))

      if (externalSongs.length > 0) {
        Song.bulkGetOrCreate(externalSongs).catch((err) => {
          console.error("[SearchController] Background save failed:", err.message)
        })
      }
    }

    const combinedSongs = [...dbSongs, ...externalSongs].slice(0, searchLimit)

    res.status(200).json({
      status: "success",
      data: {
        songs: combinedSongs,
        count: combinedSongs.length,
        source: needMoreResults ? "hybrid" : "database",
        dbCount: dbSongs.length,
        externalCount: externalSongs.length,
      },
    })
  } catch (error) {
    console.error("Error in searchSongs:", error)
    res.status(500).json({ error: "Failed to search songs" })
  }
}

module.exports = {
  searchSongs,
}
