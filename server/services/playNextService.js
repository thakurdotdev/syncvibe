const Song = require("../models/music/Song")
const HistorySong = require("../models/music/HistorySong")
const { cache } = require("../utils/redis")

const SONG_API_URL = process.env.SONG_API_URL || "https://songapi.thakur.dev"
const CACHE_PREFIX = "song:playnext:"
const CACHE_TTL = 7 * 24 * 60 * 60

let songMap = new Map()
let artistMap = new Map()
let labelMap = new Map()
let languageMap = new Map()
let albumMap = new Map()
let singerMap = new Map()
let initialized = false
let initializing = false

const normalize = (str) => (str || "").toLowerCase().trim()

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
    labelMap = new Map()
    languageMap = new Map()
    albumMap = new Map()
    singerMap = new Map()

    for (const song of songs) {
      const sd = song.songData || {}
      const entry = {
        songId: song.songId,
        songData: sd,
        name: song.name || sd.name || "Unknown",
        primaryArtist: extractPrimaryArtist(sd),
        allPrimaryArtists: extractAllPrimaryArtists(sd),
        singers: extractSingers(sd),
        albumName: normalize(song.albumName || sd.album || ""),
        language: normalize(song.language || sd.language || ""),
        label: normalize(sd.label || ""),
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
      addToMap(labelMap, entry.label, song.songId)
      addToMap(languageMap, entry.language, song.songId)
      addToMap(albumMap, entry.albumName, song.songId)
    }

    initialized = true
    initializing = false
    console.log(
      `[PlayNext] Initialized: ${songMap.size} songs, ${artistMap.size} artists, ${labelMap.size} labels, ${languageMap.size} languages, ${albumMap.size} albums`,
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
  addFromMap(languageMap, baseSong.language)
  addFromMap(labelMap, baseSong.label)

  candidates.delete(baseSong.songId)
  return candidates
}

const scoreSong = (candidate, baseSong, recentSongIds, userHistoryMap) => {
  let score = 0

  const sharedPrimaryArtists = candidate.allPrimaryArtists.filter((a) =>
    baseSong.allPrimaryArtists.includes(a),
  )
  if (sharedPrimaryArtists.length > 0) score += 60

  const sharedSingers = candidate.singers.filter((s) => baseSong.singers.includes(s))
  if (sharedSingers.length > 0) score += 40

  if (candidate.albumName && candidate.albumName === baseSong.albumName) score += 30

  if (candidate.label && candidate.label === baseSong.label) score += 25

  if (candidate.language && candidate.language === baseSong.language) score += 15

  if (candidate.duration > 0 && baseSong.duration > 0) {
    if (Math.abs(candidate.duration - baseSong.duration) < 30) score += 5
  }

  score += normalizePlayCount(candidate.playCount) * 10

  score += Math.random() * 5

  const history = userHistoryMap?.get(candidate.songId)
  if (history) {
    if (recentSongIds.has(candidate.songId)) score -= 50
    if (history.skipCount >= 5) score -= 40
    else if (history.skipCount >= 3) score -= 20
    if (history.playedCount > 10) score -= 30
    else if (history.playedCount > 5) score -= 15
  }

  return score
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

const fetchExternalRecommendations = async (songId) => {
  try {
    const response = await fetch(`${SONG_API_URL}/song/recommend?id=${songId}`)
    if (!response.ok) return []
    const json = await response.json()
    const data = json?.data || []
    return data.filter((s) => s?.id && s?.download_url?.length > 0)
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

  if (!initialized) return []

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
      const score = scoreSong(candidate, baseSong, new Set(), null)
      scored.push({ songId: id, score })
    }

    scored.sort((a, b) => b.score - a.score)
    cachedIds = scored.slice(0, 100).map((s) => s.songId)

    await cache.set(`${CACHE_PREFIX}${baseSongId}`, cachedIds, CACHE_TTL)
  }

  let resultIds = cachedIds.filter((id) => !excludeSongIds.includes(id))

  if (userId) {
    const { recentSongIds, historyMap } = await getUserHistory(userId)

    const personalized = resultIds.map((id) => {
      const candidate = songMap.get(id)
      if (!candidate) return { songId: id, score: 0 }
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

  return resultIds
    .slice(0, limit)
    .map((id) => songMap.get(id)?.songData)
    .filter(Boolean)
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
        const score = scoreSong(candidate, baseSong, new Set(), null)
        scored.push({ songId: id, score })
      }

      scored.sort((a, b) => b.score - a.score)
      const topIds = scored.slice(0, 100).map((s) => s.songId)

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

setTimeout(() => initialize(), 5000)

module.exports = {
  initialize,
  getPlayNextSongs,
  rebuildAllPlayNext,
  reload,
}
