const Song = require("../../models/music/Song")
const { Op } = require("sequelize")
const sequelize = require("../../utils/sequelize")

const SONG_API_URL = process.env.SONG_API_URL || "https://song.thakur.dev"

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

function computeRelevanceScore(song, query) {
  const q = query.toLowerCase()
  const name = (song.name || "").toLowerCase()
  const artist = (song.artist_map?.artists?.map((a) => a.name).join(" ") || "").toLowerCase()
  const album = (song.album || "").toLowerCase()

  const exactName = name === q ? 1.0 : 0
  const startsWithName = name.startsWith(q) ? 0.5 : 0
  const includesName = name.includes(q) ? 0.3 : 0
  const includesArtist = artist.includes(q) ? 0.25 : 0
  const includesAlbum = album.includes(q) ? 0.15 : 0

  const words = q.split(/\s+/)
  const wordMatchRatio =
    words.length > 1
      ? words.filter((w) => name.includes(w) || artist.includes(w)).length / words.length
      : 0

  return Math.min(
    exactName +
      startsWithName +
      includesName +
      includesArtist +
      includesAlbum +
      wordMatchRatio * 0.4,
    1.0,
  )
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

    const [dbResults, externalResults] = await Promise.all([
      Song.findAll({
        where: {
          [Op.or]: [
            sequelize.literal(`similarity("Song"."name", ${sequelize.escape(q)}) > 0.15`),
            sequelize.literal(`similarity("Song"."artistNames", ${sequelize.escape(q)}) > 0.15`),
            sequelize.literal(`similarity("Song"."albumName", ${sequelize.escape(q)}) > 0.15`),
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
        attributes: {
          include: [
            [
              sequelize.literal(`
                GREATEST(
                  similarity("Song"."name", ${sequelize.escape(q)}),
                  similarity("Song"."artistNames", ${sequelize.escape(q)}),
                  similarity("Song"."albumName", ${sequelize.escape(q)})
                )
              `),
              "similarityScore",
            ],
          ],
        },
      }),
      fetchExternalSearch(query, searchLimit),
    ])

    const scoredMap = new Map()

    for (const row of dbResults) {
      const score = parseFloat(row.getDataValue("similarityScore")) || 0
      scoredMap.set(row.songId, { song: row.songData, score })
    }

    for (const song of externalResults) {
      const score = computeRelevanceScore(song, q)
      const existing = scoredMap.get(song.id)
      if (!existing || score > existing.score) {
        scoredMap.set(song.id, { song, score })
      }
    }

    const ranked = [...scoredMap.values()].sort((a, b) => b.score - a.score).slice(0, searchLimit)

    const newExternalSongs = externalResults.filter(
      (s) => !dbResults.some((r) => r.songId === s.id),
    )
    if (newExternalSongs.length > 0) {
      Song.bulkGetOrCreate(newExternalSongs).catch((err) => {
        console.error("[SearchController] Background save failed:", err.message)
      })
    }

    res.status(200).json({
      status: "success",
      data: {
        songs: ranked.map((r) => r.song),
        count: ranked.length,
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
