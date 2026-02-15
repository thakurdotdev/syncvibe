const Song = require("../models/music/Song")
const HistorySong = require("../models/music/HistorySong")
const { cache } = require("../utils/redis")
const { Op } = require("sequelize")

const SONG_API_URL = process.env.SONG_API_URL || "https://song.thakur.dev"
const CACHE_PREFIX = "song:playnext:"
const CACHE_TTL = 7 * 24 * 60 * 60

let songMap = new Map()
let artistMap = new Map()
let composerMap = new Map()
let languageMap = new Map()
let albumMap = new Map()
let singerMap = new Map()
let nameIndex = new Map()
let initialized = false
let initializing = false

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

const dedupKey = (name, artist) => `${cleanTitle(name)}::${normalize(artist)}`

const extractPrimaryArtist = (songData) => {
  const primary = songData?.artist_map?.primary_artists?.[0]?.name
  if (primary) return normalize(primary)
  const firstArtist = songData?.artist_map?.artists?.[0]?.name
  return normalize(firstArtist || "unknown")
}

const extractSingers = (songData) => {
  const artists = songData?.artist_map?.artists || []
  return artists
    .filter((a) => a?.role?.toLowerCase().includes("singer"))
    .map((a) => normalize(a.name))
    .filter(Boolean)
}

const extractAllPrimaryArtists = (songData) => {
  const primaries = songData?.artist_map?.primary_artists || []
  return primaries.map((a) => normalize(a.name)).filter(Boolean)
}

const extractComposers = (songData) => {
  const musicField = songData?.music || ""
  return musicField
    .split(",")
    .map((c) => normalize(c))
    .filter((c) => c && c !== "unknown")
}

const addToMap = (map, key, songId) => {
  if (!key) return
  const k = normalize(key)
  if (!k || k === "unknown") return
  if (!map.has(k)) map.set(k, [])
  map.get(k).push(songId)
}

const normalizePlayCount = (playCount) => {
  if (!playCount || playCount <= 0) return 0
  return Math.min(Math.log10(playCount) / 9, 1)
}

const initialize = async () => {
  if (initialized || initializing) return
  initializing = true
  try {
    const songs = await Song.findAll({
      attributes: [
        "songId",
        "name",
        "artistNames",
        "albumName",
        "language",
        "duration",
        "songData",
      ],
      raw: true,
    })

    songMap = new Map()
    artistMap = new Map()
    composerMap = new Map()
    languageMap = new Map()
    albumMap = new Map()
    singerMap = new Map()
    nameIndex = new Map()

    for (const song of songs) {
      const sd = song.songData || {}
      const primaryArtist = extractPrimaryArtist(sd)
      const dk = dedupKey(song.name || sd.name, primaryArtist)

      if (nameIndex.has(dk)) {
        const existing = songMap.get(nameIndex.get(dk))
        if (existing && (sd.play_count || 0) <= (existing.playCount || 0)) continue
        songMap.delete(nameIndex.get(dk))
      }
      nameIndex.set(dk, song.songId)

      const composers = extractComposers(sd)
      const entry = {
        songId: song.songId,
        name: song.name || sd.name || "Unknown",
        primaryArtist,
        allPrimaryArtists: extractAllPrimaryArtists(sd),
        singers: extractSingers(sd),
        composers,
        albumName: normalize(song.albumName || sd.album || ""),
        language: normalize(song.language || sd.language || ""),
        duration: song.duration || sd.duration || 0,
        playCount: sd.play_count || 0,
        year: sd.year || 0,
      }

      songMap.set(song.songId, entry)

      addToMap(artistMap, entry.primaryArtist, song.songId)
      for (const artist of entry.allPrimaryArtists) {
        addToMap(artistMap, artist, song.songId)
      }
      for (const singer of entry.singers) {
        addToMap(singerMap, singer, song.songId)
      }
      for (const composer of composers) {
        addToMap(composerMap, composer, song.songId)
      }
      addToMap(languageMap, entry.language, song.songId)
      addToMap(albumMap, entry.albumName, song.songId)
    }

    initialized = true
    initializing = false
    await cache.set("playnext:last_init", Date.now(), 0)
    console.log(
      `[PlayNext] Initialized: ${songMap.size} songs, ${artistMap.size} artists, ${composerMap.size} composers, ${languageMap.size} languages, ${albumMap.size} albums`,
    )
  } catch (err) {
    initializing = false
    console.error("[PlayNext] Initialization failed:", err.message)
  }
}

const collectCandidates = (baseSong, excludeSet) => {
  const candidates = new Set()

  const addFromMap = (map, key) => {
    const ids = map.get(key)
    if (!ids) return
    for (const id of ids) {
      if (!excludeSet.has(id)) candidates.add(id)
    }
  }

  addFromMap(artistMap, baseSong.primaryArtist)
  for (const artist of baseSong.allPrimaryArtists) {
    addFromMap(artistMap, artist)
  }
  for (const singer of baseSong.singers) {
    addFromMap(singerMap, singer)
  }
  for (const composer of baseSong.composers) {
    addFromMap(composerMap, composer)
  }
  if (baseSong.albumName) {
    addFromMap(albumMap, baseSong.albumName)
  }
  addFromMap(languageMap, baseSong.language)

  candidates.delete(baseSong.songId)
  return candidates
}

const scoreSong = (candidate, baseSong) => {
  let score = 0

  if (candidate.albumName && candidate.albumName === baseSong.albumName) score += 50

  const sharedPrimaryArtists = candidate.allPrimaryArtists.filter((a) =>
    baseSong.allPrimaryArtists.includes(a),
  )
  if (sharedPrimaryArtists.length > 0) score += 45

  const sharedSingers = candidate.singers.filter((s) => baseSong.singers.includes(s))
  if (sharedSingers.length > 0) score += 35

  const sharedComposers = candidate.composers.filter((c) => baseSong.composers.includes(c))
  if (sharedComposers.length > 0) score += 30

  if (candidate.language && candidate.language === baseSong.language) score += 15

  if (candidate.year > 0 && baseSong.year > 0) {
    const yearDiff = Math.abs(candidate.year - baseSong.year)
    if (yearDiff === 0) score += 10
    else if (yearDiff <= 2) score += 7
    else if (yearDiff <= 5) score += 3
  }

  if (candidate.duration > 0 && baseSong.duration > 0) {
    const durationDiff = Math.abs(candidate.duration - baseSong.duration)
    if (durationDiff < 30) score += 5
    else if (durationDiff < 60) score += 2
  }

  score += normalizePlayCount(candidate.playCount) * 8

  score += Math.random() * 3

  return score
}

const diversify = (scored, songMap, limit) => {
  const result = []
  const artistCount = new Map()
  const seenNames = new Set()
  const MAX_PER_ARTIST = 4

  for (const item of scored) {
    if (result.length >= limit) break

    const entry = songMap.get(item.songId)
    if (!entry) continue

    const nameKey = cleanTitle(entry.name)
    if (seenNames.has(nameKey)) continue
    seenNames.add(nameKey)

    const artist = entry.primaryArtist
    const count = artistCount.get(artist) || 0
    if (count >= MAX_PER_ARTIST) continue

    artistCount.set(artist, count + 1)
    result.push(item.songId)
  }

  return result
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

const getPlayNextSongs = async ({ baseSongId, userId = null, limit = 20, excludeSongIds = [] }) => {
  const external = await fetchExternalRecommendations(baseSongId)
  if (external.length > 0) {
    const excludeSet = new Set(excludeSongIds)
    return external.filter((s) => !excludeSet.has(s.id)).slice(0, limit)
  }

  if (!initialized) {
    initialize()
    return []
  }

  const baseSong = songMap.get(baseSongId)
  if (!baseSong) {
    throw new Error(`Song not found: ${baseSongId}`)
  }

  let cachedIds = await cache.get(`${CACHE_PREFIX}${baseSongId}`)

  if (!cachedIds) {
    const excludeSet = new Set(excludeSongIds)
    excludeSet.add(baseSongId)

    const candidateIds = collectCandidates(baseSong, excludeSet)

    const scored = []
    for (const id of candidateIds) {
      const candidate = songMap.get(id)
      if (!candidate) continue
      const score = scoreSong(candidate, baseSong)
      scored.push({ songId: id, score })
    }

    scored.sort((a, b) => b.score - a.score)
    cachedIds = diversify(scored, songMap, 100)

    await cache.set(`${CACHE_PREFIX}${baseSongId}`, cachedIds, CACHE_TTL)
  }

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
  await initialize()

  let processed = 0
  const allSongIds = Array.from(songMap.keys())

  const BATCH_SIZE = 500
  for (let i = 0; i < allSongIds.length; i += BATCH_SIZE) {
    const batch = allSongIds.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (songId) => {
      const baseSong = songMap.get(songId)
      if (!baseSong) return

      const excludeSet = new Set([songId])
      const candidateIds = collectCandidates(baseSong, excludeSet)

      const scored = []
      for (const id of candidateIds) {
        const candidate = songMap.get(id)
        if (!candidate) continue
        const score = scoreSong(candidate, baseSong)
        scored.push({ songId: id, score })
      }

      scored.sort((a, b) => b.score - a.score)
      const topIds = diversify(scored, songMap, 100)

      await cache.set(`${CACHE_PREFIX}${songId}`, topIds, 0)
      processed++
    })

    await Promise.all(promises)
    console.log(`[PlayNext] Rebuilt ${processed}/${allSongIds.length}`)
  }

  console.log(`[PlayNext] Rebuild complete: ${processed} songs processed`)
  return { processed, total: allSongIds.length }
}

const reload = async () => {
  initialized = false
  initializing = false
  await initialize()
}

cache.get("playnext:last_init").then((ts) => {
  if (ts) console.log(`[PlayNext] Last init: ${new Date(ts).toISOString()} — skipping eager load`)
  else console.log("[PlayNext] No previous init found — will load lazily on first fallback request")
})

module.exports = {
  initialize,
  getPlayNextSongs,
  rebuildAllPlayNext,
  reload,
}
