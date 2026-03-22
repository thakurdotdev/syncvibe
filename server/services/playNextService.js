const Song = require("../models/music/Song")
const HistorySong = require("../models/music/HistorySong")
const { cache, getRedis } = require("../utils/redis")
const { Op } = require("sequelize")

const SONG_API_URL = process.env.SONG_API_URL || "https://song.thakur.dev"
const CACHE_PREFIX = "pn:v3:"
const CACHE_TTL = 30 * 24 * 60 * 60
const SONG_ATTRS = ["songId", "name", "artistNames", "albumName", "language", "duration", "songData"]

const MIN_SCORE_THRESHOLD = 30

const buildArtistILike = (name) => {
  if (name.length <= 3) {
    return {
      [Op.or]: [
        { artistNames: { [Op.iLike]: `${name}` } },
        { artistNames: { [Op.iLike]: `${name}, %` } },
        { artistNames: { [Op.iLike]: `%, ${name}` } },
        { artistNames: { [Op.iLike]: `%, ${name}, %` } },
      ],
    }
  }
  return { artistNames: { [Op.iLike]: `%${name}%` } }
}

const VARIANT_TAGS = [
  "remix", "dubstep", "edm", "lofi", "lo-fi", "slowed", "reverb", "8d",
  "mashup", "nightcore", "bass boosted", "phonk", "trap", "instrumental",
  "karaoke", "cover", "unplugged", "acoustic", "reprise", "jhankar", "jhankar beats",
]

const normalize = (str) => (str || "").toLowerCase().trim()

const cleanTitle = (name) => {
  return normalize(name)
    .replace(/\s*[\(\[].*?[\)\]]/g, "")
    .replace(
      /\s*-\s*(from|feat|ft|remix|unplugged|reprise|acoustic|lofi|slowed|reverb|version|male|female|duet|sad|happy|jhankar|remastered|deluxe).*$/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
}

const hasVariantTag = (name) => {
  const lower = normalize(name)
  return VARIANT_TAGS.some((tag) => {
    const pattern = new RegExp(`\\b${tag}\\b|[\\(\\[]\\s*${tag}`, "i")
    return pattern.test(lower)
  })
}

const dedupKey = (name, artist) => `${cleanTitle(name)}::${normalize(artist)}`

const extractSingers = (songData) => {
  const artists = songData?.artist_map?.artists || []
  return artists
    .filter((a) => {
      const role = (a?.role || "").toLowerCase()
      return role.includes("singer") && !role.includes("music")
    })
    .map((a) => normalize(a.name))
    .filter(Boolean)
}

const extractMusicDirectors = (songData) => {
  const artists = songData?.artist_map?.artists || []
  const fromRole = artists
    .filter((a) => {
      const role = (a?.role || "").toLowerCase()
      return role.includes("music") || role === "composer"
    })
    .map((a) => normalize(a.name))

  const fromField = (songData?.music || "")
    .split(",")
    .map((c) => normalize(c))
    .filter((c) => c && c !== "unknown")

  return [...new Set([...fromRole, ...fromField])].filter(Boolean)
}

const extractLyricists = (songData) => {
  const artists = songData?.artist_map?.artists || []
  return artists
    .filter((a) => (a?.role || "").toLowerCase().includes("lyricist"))
    .map((a) => normalize(a.name))
    .filter(Boolean)
}

const normalizePlayCount = (playCount) => {
  if (!playCount || playCount <= 0) return 0
  return Math.min(Math.log10(playCount) / 9, 1)
}

const buildEntry = (song) => {
  const sd = song.songData || {}
  return {
    songId: song.songId,
    name: song.name || sd.name || "Unknown",
    singers: extractSingers(sd),
    musicDirectors: extractMusicDirectors(sd),
    lyricists: extractLyricists(sd),
    albumName: normalize(song.albumName || sd.album || ""),
    albumId: sd.album_id || "",
    language: normalize(song.language || sd.language || ""),
    duration: song.duration || sd.duration || 0,
    playCount: sd.play_count || 0,
    year: sd.year || 0,
    isVariant: hasVariantTag(song.name || sd.name || ""),
  }
}

const scoreSong = (candidate, baseSong) => {
  let score = 0

  if (baseSong.isVariant !== candidate.isVariant) {
    score -= 40
  }

  if (candidate.albumId && candidate.albumId === baseSong.albumId) {
    score += 60
  } else if (candidate.albumName && candidate.albumName === baseSong.albumName) {
    score += 55
  }

  const sharedSingers = candidate.singers.filter((s) => baseSong.singers.includes(s))
  score += Math.min(sharedSingers.length, 3) * 35

  const sharedMDs = candidate.musicDirectors.filter((m) => baseSong.musicDirectors.includes(m))
  score += Math.min(sharedMDs.length, 2) * 8

  const sharedLyricists = candidate.lyricists.filter((l) => baseSong.lyricists.includes(l))
  if (sharedLyricists.length > 0) score += 5

  if (candidate.language && candidate.language === baseSong.language) {
    score += 10
  } else if (candidate.language && baseSong.language && candidate.language !== baseSong.language) {
    score -= 30
  }

  if (candidate.year > 0 && baseSong.year > 0) {
    const yearDiff = Math.abs(candidate.year - baseSong.year)
    if (yearDiff === 0) score += 8
    else if (yearDiff <= 2) score += 5
    else if (yearDiff <= 5) score += 2
    else if (yearDiff > 10) score -= 10
  }

  if (candidate.duration > 0 && baseSong.duration > 0) {
    const durationDiff = Math.abs(candidate.duration - baseSong.duration)
    if (durationDiff < 30) score += 3
  }

  score += normalizePlayCount(candidate.playCount) * 5

  return score
}

const diversifyScored = (scored, limit) => {
  const result = []
  const singerGroupCount = new Map()
  const seenNames = new Set()
  const MAX_PER_SINGER = 4

  for (const item of scored) {
    if (result.length >= limit) break

    const nameKey = cleanTitle(item.name)
    if (seenNames.has(nameKey)) continue
    seenNames.add(nameKey)

    const topSinger = item.topSinger || "unknown"
    const count = singerGroupCount.get(topSinger) || 0
    if (count >= MAX_PER_SINGER) continue
    singerGroupCount.set(topSinger, count + 1)

    result.push(item.songId)
  }

  return result
}

const computeForSong = async (baseSongId) => {
  const baseSongRow = await Song.findOne({
    where: { songId: baseSongId },
    attributes: SONG_ATTRS,
    raw: true,
  })
  if (!baseSongRow) return []

  const baseSong = buildEntry(baseSongRow)

  const singerConditions = baseSong.singers
    .filter((s) => s && s !== "unknown")
    .slice(0, 5)
    .map((singer) => buildArtistILike(singer))

  const albumCondition = baseSongRow.albumName
    ? [{ albumName: baseSongRow.albumName }]
    : []

  const primaryConditions = [...singerConditions, ...albumCondition]

  if (primaryConditions.length === 0) return []

  const primaryCandidates = await Song.findAll({
    where: {
      [Op.or]: primaryConditions,
      songId: { [Op.ne]: baseSongId },
    },
    attributes: SONG_ATTRS,
    raw: true,
    limit: 300,
  })

  let allCandidates = [...primaryCandidates]

  if (allCandidates.length < 80) {
    const existingIds = new Set(allCandidates.map((c) => c.songId))
    existingIds.add(baseSongId)

    const mdConditions = baseSong.musicDirectors
      .filter((m) => m && m !== "unknown")
      .slice(0, 3)
      .map((md) => buildArtistILike(md))

    if (mdConditions.length > 0 && baseSong.language) {
      const { sequelize } = Song
      const yearFilter = baseSong.year > 0
        ? sequelize.where(
            sequelize.cast(sequelize.json("songData.year"), "integer"),
            { [Op.between]: [baseSong.year - 10, baseSong.year + 10] },
          )
        : undefined

      const supplementary = await Song.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: mdConditions },
            { language: baseSong.language },
            { songId: { [Op.notIn]: [...existingIds] } },
            yearFilter,
          ],
        },
        attributes: SONG_ATTRS,
        raw: true,
        limit: 150,
      })

      allCandidates = [...allCandidates, ...supplementary]
    }
  }

  const seen = new Set()
  const scored = []

  for (const c of allCandidates) {
    const entry = buildEntry(c)
    const dk = dedupKey(entry.name, entry.singers[0] || "unknown")
    if (seen.has(dk)) continue
    seen.add(dk)

    const score = scoreSong(entry, baseSong)
    if (score < MIN_SCORE_THRESHOLD) continue

    scored.push({
      songId: entry.songId,
      score,
      name: entry.name,
      topSinger: entry.singers[0] || "unknown",
    })
  }

  scored.sort((a, b) => b.score - a.score)
  return diversifyScored(scored, 100)
}

const deduplicateExternal = (songs) => {
  const seen = new Set()
  return songs.filter((s) => {
    const key = dedupKey(s.name, s.artist_map?.primary_artists?.[0]?.name || "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const fetchExternalRecommendations = async (songId) => {
  try {
    const response = await fetch(`${SONG_API_URL}/song/recommend?id=${songId}`)
    if (!response.ok) return []
    const json = await response.json()
    const data = json?.data || []
    const valid = data.filter((s) => s?.id && s?.download_url?.length > 0)
    return deduplicateExternal(valid)
  } catch {
    return []
  }
}

const getUserHistory = async (userId) => {
  if (!userId) return { recentSongIds: new Set(), historyMap: new Map() }

  const recentEntries = await HistorySong.findAll({
    where: { userId },
    attributes: ["songRefId", "playedCount", "skipCount", "lastPlayedAt"],
    order: [["lastPlayedAt", "DESC"]],
    limit: 50,
    raw: true,
  })

  const recentSongIds = new Set()
  const historyMap = new Map()

  const songIdsByRefId = await Song.findAll({
    where: { id: recentEntries.map((e) => e.songRefId) },
    attributes: ["id", "songId"],
    raw: true,
  })

  const refIdToSongId = new Map()
  for (const s of songIdsByRefId) {
    refIdToSongId.set(s.id, s.songId)
  }

  for (let i = 0; i < recentEntries.length; i++) {
    const entry = recentEntries[i]
    const songId = refIdToSongId.get(entry.songRefId)
    if (!songId) continue

    if (i < 10) recentSongIds.add(songId)

    historyMap.set(songId, {
      playedCount: entry.playedCount || 0,
      skipCount: entry.skipCount || 0,
    })
  }

  return { recentSongIds, historyMap }
}

const getPlayNextSongs = async ({ baseSongId, userId = null, limit = 20, excludeSongIds = [] }) => {
  const external = await fetchExternalRecommendations(baseSongId)
  if (external.length > 0) {
    const excludeSet = new Set(excludeSongIds)
    return external.filter((s) => !excludeSet.has(s.id)).slice(0, limit)
  }

  let cachedIds = await cache.get(`${CACHE_PREFIX}${baseSongId}`)

  if (!cachedIds) {
    cachedIds = await computeForSong(baseSongId)
    if (cachedIds.length > 0) {
      await cache.set(`${CACHE_PREFIX}${baseSongId}`, cachedIds, CACHE_TTL)
    }
  }

  if (!cachedIds || cachedIds.length === 0) return []

  let resultIds = cachedIds.filter((id) => !excludeSongIds.includes(id))

  if (userId) {
    const { recentSongIds, historyMap } = await getUserHistory(userId)

    const personalized = resultIds.map((id) => {
      let penalty = 0
      const history = historyMap.get(id)
      if (history) {
        if (recentSongIds.has(id)) penalty -= 50
        if (history.skipCount >= 5) penalty -= 40
        else if (history.skipCount >= 3) penalty -= 20
        if (history.playedCount > 10) penalty -= 30
        else if (history.playedCount > 5) penalty -= 15
      }
      return { songId: id, score: penalty }
    })

    personalized.sort((a, b) => b.score - a.score)
    resultIds = personalized.map((p) => p.songId)
  }

  const finalIds = resultIds.slice(0, limit)
  if (finalIds.length === 0) return []

  const songs = await Song.findAll({
    where: { songId: { [Op.in]: finalIds } },
    attributes: ["songId", "songData"],
    raw: true,
  })

  const dataMap = new Map()
  for (const s of songs) dataMap.set(s.songId, s.songData)

  return finalIds.map((id) => dataMap.get(id)).filter(Boolean)
}

const rebuildAllPlayNext = async () => {
  const allSongs = await Song.findAll({ attributes: ["songId"], raw: true })
  const total = allSongs.length
  let processed = 0
  const BATCH = 20

  for (let i = 0; i < total; i += BATCH) {
    const batch = allSongs.slice(i, i + BATCH)

    await Promise.all(
      batch.map(async ({ songId }) => {
        const ids = await computeForSong(songId)
        if (ids.length > 0) {
          await cache.set(`${CACHE_PREFIX}${songId}`, ids, CACHE_TTL)
        }
        processed++
      }),
    )

    console.log(`[PlayNext] Rebuilt ${processed}/${total}`)
  }

  await cache.set("playnext:last_rebuild", Date.now(), CACHE_TTL)
  console.log(`[PlayNext] Rebuild complete: ${processed} songs processed`)
  return { processed, total }
}

const invalidateSong = async (songId) => {
  await cache.del(`${CACHE_PREFIX}${songId}`)
}

module.exports = {
  getPlayNextSongs,
  rebuildAllPlayNext,
  invalidateSong,
}
