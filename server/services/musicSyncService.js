const Song = require("../models/music/Song")

const SONG_API_URL = process.env.SONG_API_URL || "https://songapi.thakur.dev"
const BATCH_SIZE = parseInt(process.env.MUSIC_SYNC_BATCH_SIZE || "3", 10)
const BATCH_DELAY_MS = parseInt(process.env.MUSIC_SYNC_BATCH_DELAY_MS || "500", 10)
const SYNC_INTERVAL_HOURS = parseInt(process.env.MUSIC_SYNC_INTERVAL_HOURS || "6", 10)

const POPULAR_ARTISTS = [
  { id: "459320", name: "Arijit Singh" },
  { id: "455125", name: "Shreya Ghoshal" },
  { id: "456863", name: "Sonu Nigam" },
  { id: "455130", name: "AR Rahman" },
  { id: "455124", name: "Kumar Sanu" },
  { id: "455143", name: "Udit Narayan" },
  { id: "455127", name: "Lata Mangeshkar" },
  { id: "455128", name: "Kishore Kumar" },
  { id: "455789", name: "Alka Yagnik" },
  { id: "455132", name: "Asha Bhosle" },
  { id: "464656", name: "Pritam" },
  { id: "459633", name: "Neha Kakkar" },
  { id: "468245", name: "Badshah" },
  { id: "458946", name: "Atif Aslam" },
  { id: "459381", name: "Jubin Nautiyal" },
  { id: "455926", name: "Honey Singh" },
  { id: "461968", name: "Vishal Mishra" },
  { id: "455129", name: "Mohammed Rafi" },
  { id: "480516", name: "Tanishk Bagchi" },
  { id: "456323", name: "Mithoon" },
]

const SEARCH_QUERIES = [
  "90s bollywood hits",
  "2000s hindi songs",
  "romantic bollywood songs",
  "sad songs hindi",
  "party songs bollywood",
  "old hindi classics",
  "retro bollywood",
  "love songs hindi",
  "dance songs bollywood",
  "unplugged hindi",
  "sufi songs",
  "ghazals hindi",
  "devotional songs",
  "wedding songs bollywood",
  "rain songs hindi",
]

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function shuffleArray(array) {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (err) {
      if (i === retries) throw err
      await delay(1000 * (i + 1))
    }
  }
}

async function fetchModulesData(lang = "hindi") {
  const url = `${SONG_API_URL}/modules?lang=${lang}&mini=true`
  console.log(`[MusicSync] Fetching modules: ${url}`)
  const response = await fetchWithRetry(url)
  return response?.data || {}
}

async function fetchTrending(lang = "hindi") {
  const url = `${SONG_API_URL}/get/trending?lang=${lang}`
  console.log(`[MusicSync] Fetching trending`)
  const response = await fetchWithRetry(url)
  return response?.data || []
}

async function fetchCharts(lang = "hindi") {
  const url = `${SONG_API_URL}/get/charts?lang=${lang}`
  console.log(`[MusicSync] Fetching charts`)
  const response = await fetchWithRetry(url)
  return response?.data || []
}

async function fetchTopAlbums(lang = "hindi") {
  const url = `${SONG_API_URL}/get/top-albums?lang=${lang}`
  console.log(`[MusicSync] Fetching top albums`)
  const response = await fetchWithRetry(url)
  return response?.data || []
}

async function fetchFeaturedPlaylists(lang = "hindi") {
  const url = `${SONG_API_URL}/get/featured-playlists?lang=${lang}`
  console.log(`[MusicSync] Fetching featured playlists`)
  const response = await fetchWithRetry(url)
  return response?.data || []
}

async function fetchAlbumSongs(albumId) {
  const url = `${SONG_API_URL}/album?id=${albumId}`
  console.log(`[MusicSync] Fetching album: ${albumId}`)
  const response = await fetchWithRetry(url)
  return response?.data?.songs || []
}

async function fetchPlaylistSongs(playlistId) {
  const url = `${SONG_API_URL}/playlist?id=${playlistId}`
  console.log(`[MusicSync] Fetching playlist: ${playlistId}`)
  const response = await fetchWithRetry(url)
  return response?.data?.songs || []
}

async function fetchArtistTopSongs(artistId, limit = 50) {
  const url = `${SONG_API_URL}/artist?id=${artistId}`
  console.log(`[MusicSync] Fetching artist top songs: ${artistId}`)
  const response = await fetchWithRetry(url)
  const songs = response?.data?.top_songs || []
  return songs.slice(0, limit)
}

async function fetchArtistSongs(artistId, page = 0) {
  const url = `${SONG_API_URL}/artist/songs?id=${artistId}&page=${page}`
  console.log(`[MusicSync] Fetching artist songs: ${artistId}, page: ${page}`)
  const response = await fetchWithRetry(url)
  return response?.data?.top_songs?.songs || []
}

async function fetchSearchSongs(query, page = 0, limit = 30) {
  const url = `${SONG_API_URL}/search/songs?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
  console.log(`[MusicSync] Searching songs: ${query}`)
  const response = await fetchWithRetry(url)
  const results = response?.data?.results || []

  if (results.length === 0) return []

  const songIds = results.map((s) => s.id).filter(Boolean)
  const fullSongs = await fetchSongsByIds(songIds)
  return fullSongs
}

async function fetchSongsByIds(songIds) {
  if (!songIds.length) return []

  const idsParam = songIds.slice(0, 20).join(",")
  const url = `${SONG_API_URL}/song?id=${idsParam}`
  console.log(`[MusicSync] Fetching ${songIds.length} songs by ID`)
  const response = await fetchWithRetry(url)
  return response?.data?.songs || response?.data || []
}

async function fetchSongRecommendations(songId) {
  const url = `${SONG_API_URL}/song/recommend?id=${songId}`
  const response = await fetchWithRetry(url)
  return response?.data || []
}

function extractSongsFromModules(modulesData) {
  const songs = []
  const albumIds = new Set()
  const playlistIds = new Set()
  const seenSongIds = new Set()

  const processItem = (item) => {
    if (!item?.id) return

    if (item.type === "song" && item.download_url?.length > 0) {
      if (!seenSongIds.has(item.id)) {
        seenSongIds.add(item.id)
        songs.push(item)
      }
    } else if (item.type === "album") {
      albumIds.add(item.id)
    } else if (item.type === "playlist") {
      playlistIds.add(item.id)
    }
  }

  const sections = ["trending", "charts", "albums", "playlists", "artist_recos"]
  for (const section of sections) {
    const data = modulesData[section]?.data || []
    data.forEach(processItem)
  }

  return { songs, albumIds: [...albumIds], playlistIds: [...playlistIds] }
}

async function filterExistingSongIds(songIds) {
  if (!songIds.length) return songIds

  const existing = await Song.findAll({
    where: { songId: songIds },
    attributes: ["songId"],
    raw: true,
  })
  const existingSet = new Set(existing.map((s) => s.songId))
  return songIds.filter((id) => !existingSet.has(id))
}

async function batchFetchAlbums(albumIds) {
  const allSongs = []
  for (let i = 0; i < albumIds.length; i += BATCH_SIZE) {
    const batch = albumIds.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return await fetchAlbumSongs(id)
        } catch (err) {
          console.error(`[MusicSync] Failed to fetch album ${id}:`, err.message)
          return []
        }
      }),
    )

    results.forEach((songs) => allSongs.push(...songs))

    if (i + BATCH_SIZE < albumIds.length) {
      await delay(BATCH_DELAY_MS)
    }
  }
  return allSongs
}

async function batchFetchPlaylists(playlistIds) {
  const allSongs = []
  for (let i = 0; i < playlistIds.length; i += BATCH_SIZE) {
    const batch = playlistIds.slice(i, i + BATCH_SIZE)

    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return await fetchPlaylistSongs(id)
        } catch (err) {
          console.error(`[MusicSync] Failed to fetch playlist ${id}:`, err.message)
          return []
        }
      }),
    )

    results.forEach((songs) => allSongs.push(...songs))

    if (i + BATCH_SIZE < playlistIds.length) {
      await delay(BATCH_DELAY_MS)
    }
  }
  return allSongs
}

async function batchFetchRecommendations(songIds) {
  const allSongs = []
  const batchSize = 3
  for (let i = 0; i < songIds.length; i += batchSize) {
    const batch = songIds.slice(i, i + batchSize)

    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return await fetchSongRecommendations(id)
        } catch (err) {
          return []
        }
      }),
    )

    results.forEach((songs) => allSongs.push(...songs))

    if (i + batchSize < songIds.length) {
      await delay(BATCH_DELAY_MS)
    }
  }
  return allSongs
}

async function processSongsForDb(songs, stats) {
  const songMap = new Map()
  for (const song of songs) {
    if (song?.id && song.download_url?.length > 0) {
      songMap.set(song.id, song)
    }
  }

  const uniqueSongs = [...songMap.values()]
  const songIds = uniqueSongs.map((s) => s.id)
  const newSongIds = await filterExistingSongIds(songIds)
  const songsToAdd = uniqueSongs.filter((s) => newSongIds.includes(s.id))

  if (songsToAdd.length > 0) {
    try {
      const result = await Song.bulkGetOrCreate(songsToAdd)
      stats.songsAdded += result.created || result.total || 0
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Bulk insert failed:`, err.message)
    }
  }

  stats.songsSkipped += uniqueSongs.length - songsToAdd.length
  return songsToAdd.length
}

async function syncModulesData(languages = ["hindi"]) {
  const startTime = Date.now()
  const stats = {
    songsAdded: 0,
    songsSkipped: 0,
    albumsFetched: 0,
    playlistsFetched: 0,
    recommendationsFetched: 0,
    errors: 0,
    apiCalls: 0,
  }

  console.log(`[MusicSync] Starting modules sync for languages: ${languages.join(", ")}`)

  for (const lang of languages) {
    try {
      const modulesData = await fetchModulesData(lang)
      stats.apiCalls++

      const { songs: inlineSongs, albumIds, playlistIds } = extractSongsFromModules(modulesData)
      console.log(
        `[MusicSync] ${lang}: Found ${inlineSongs.length} inline songs, ${albumIds.length} albums, ${playlistIds.length} playlists`,
      )

      const shuffledAlbumIds = shuffleArray(albumIds).slice(0, 5)
      const albumSongs = await batchFetchAlbums(shuffledAlbumIds)
      stats.albumsFetched = shuffledAlbumIds.length
      stats.apiCalls += shuffledAlbumIds.length

      const shuffledPlaylistIds = shuffleArray(playlistIds).slice(0, 5)
      const playlistSongs = await batchFetchPlaylists(shuffledPlaylistIds)
      stats.playlistsFetched = shuffledPlaylistIds.length
      stats.apiCalls += shuffledPlaylistIds.length

      const shuffledSeedSongs = shuffleArray(inlineSongs).slice(0, 3)
      const seedSongIds = shuffledSeedSongs.map((s) => s.id)
      const recommendedSongs = await batchFetchRecommendations(seedSongIds)
      stats.recommendationsFetched = seedSongIds.length
      stats.apiCalls += seedSongIds.length
      console.log(`[MusicSync] ${lang}: Fetched ${recommendedSongs.length} recommended songs`)

      const allSongs = [...inlineSongs, ...albumSongs, ...playlistSongs, ...recommendedSongs]
      await processSongsForDb(allSongs, stats)
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Failed to sync ${lang}:`, err.message)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[MusicSync] Modules sync completed in ${duration}s:`, stats)

  return { ...stats, durationSeconds: parseFloat(duration), type: "modules" }
}

async function syncArtistCatalogs(artistIds = null, topSongsLimit = 50) {
  const startTime = Date.now()
  const stats = {
    songsAdded: 0,
    songsSkipped: 0,
    artistsFetched: 0,
    errors: 0,
    apiCalls: 0,
  }

  const artists = artistIds
    ? POPULAR_ARTISTS.filter((a) => artistIds.includes(a.id))
    : shuffleArray(POPULAR_ARTISTS).slice(0, 5)

  console.log(`[MusicSync] Starting artist catalog sync for ${artists.length} artists`)

  for (const artist of artists) {
    try {
      const songs = await fetchArtistTopSongs(artist.id, topSongsLimit)
      stats.apiCalls++
      stats.artistsFetched++

      console.log(`[MusicSync] ${artist.name}: Fetched ${songs.length} top songs`)

      await processSongsForDb(songs, stats)
      await delay(BATCH_DELAY_MS)
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Failed to fetch artist ${artist.name}:`, err.message)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[MusicSync] Artist sync completed in ${duration}s:`, stats)

  return { ...stats, durationSeconds: parseFloat(duration), type: "artist" }
}

async function syncArtistDeepCatalog(artistId, pages = 3) {
  const startTime = Date.now()
  const stats = {
    songsAdded: 0,
    songsSkipped: 0,
    pagesFetched: 0,
    errors: 0,
    apiCalls: 0,
  }

  console.log(`[MusicSync] Starting deep catalog sync for artist: ${artistId}`)

  const allSongs = []
  for (let page = 0; page < pages; page++) {
    try {
      const songs = await fetchArtistSongs(artistId, page)
      stats.apiCalls++
      stats.pagesFetched++

      if (songs.length === 0) break
      allSongs.push(...songs)
      console.log(`[MusicSync] Page ${page}: Fetched ${songs.length} songs`)
      await delay(BATCH_DELAY_MS)
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Failed page ${page}:`, err.message)
      break
    }
  }

  await processSongsForDb(allSongs, stats)

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[MusicSync] Deep catalog sync completed in ${duration}s:`, stats)

  return { ...stats, durationSeconds: parseFloat(duration), type: "artist-deep" }
}

async function syncSearchQueries(queries = null, limit = 3) {
  const startTime = Date.now()
  const stats = {
    songsAdded: 0,
    songsSkipped: 0,
    queriesProcessed: 0,
    errors: 0,
    apiCalls: 0,
  }

  const searchBatch = queries || shuffleArray(SEARCH_QUERIES).slice(0, limit)
  console.log(`[MusicSync] Starting search-based sync for ${searchBatch.length} queries`)

  for (const query of searchBatch) {
    try {
      const songs = await fetchSearchSongs(query, 0, 30)
      stats.apiCalls++
      stats.queriesProcessed++

      console.log(`[MusicSync] "${query}": Found ${songs.length} songs`)

      await processSongsForDb(songs, stats)
      await delay(BATCH_DELAY_MS)
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Search failed for "${query}":`, err.message)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[MusicSync] Search sync completed in ${duration}s:`, stats)

  return { ...stats, durationSeconds: parseFloat(duration), type: "search" }
}

async function syncFeaturedPlaylists(languages = ["hindi"], limit = 5) {
  const startTime = Date.now()
  const stats = {
    songsAdded: 0,
    songsSkipped: 0,
    playlistsFetched: 0,
    errors: 0,
    apiCalls: 0,
  }

  console.log(`[MusicSync] Starting featured playlists sync`)

  for (const lang of languages) {
    try {
      const playlists = await fetchFeaturedPlaylists(lang)
      stats.apiCalls++

      const playlistIds = playlists
        .filter((p) => p?.id)
        .slice(0, limit)
        .map((p) => p.id)

      const allSongs = await batchFetchPlaylists(playlistIds)
      stats.playlistsFetched += playlistIds.length
      stats.apiCalls += playlistIds.length

      console.log(
        `[MusicSync] ${lang}: Fetched ${allSongs.length} songs from ${playlistIds.length} playlists`,
      )

      await processSongsForDb(allSongs, stats)
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Featured playlists failed for ${lang}:`, err.message)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[MusicSync] Featured playlists sync completed in ${duration}s:`, stats)

  return { ...stats, durationSeconds: parseFloat(duration), type: "featured-playlists" }
}

async function syncTopAlbums(languages = ["hindi"], limit = 5) {
  const startTime = Date.now()
  const stats = {
    songsAdded: 0,
    songsSkipped: 0,
    albumsFetched: 0,
    errors: 0,
    apiCalls: 0,
  }

  console.log(`[MusicSync] Starting top albums sync`)

  for (const lang of languages) {
    try {
      const albums = await fetchTopAlbums(lang)
      stats.apiCalls++

      const albumIds = albums
        .filter((a) => a?.id)
        .slice(0, limit)
        .map((a) => a.id)

      const allSongs = await batchFetchAlbums(albumIds)
      stats.albumsFetched += albumIds.length
      stats.apiCalls += albumIds.length

      console.log(
        `[MusicSync] ${lang}: Fetched ${allSongs.length} songs from ${albumIds.length} albums`,
      )

      await processSongsForDb(allSongs, stats)
    } catch (err) {
      stats.errors++
      console.error(`[MusicSync] Top albums failed for ${lang}:`, err.message)
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[MusicSync] Top albums sync completed in ${duration}s:`, stats)

  return { ...stats, durationSeconds: parseFloat(duration), type: "top-albums" }
}

async function syncFull(options = {}) {
  const startTime = Date.now()
  const languages = options.languages || ["hindi"]
  const results = []

  console.log(`[MusicSync] Starting FULL sync...`)

  const modulesResult = await syncModulesData(languages)
  results.push(modulesResult)
  await delay(1000)

  const artistResult = await syncArtistCatalogs(null, 50)
  results.push(artistResult)
  await delay(1000)

  const searchResult = await syncSearchQueries(null, 5)
  results.push(searchResult)
  await delay(1000)

  const featuredResult = await syncFeaturedPlaylists(languages, 5)
  results.push(featuredResult)
  await delay(1000)

  const topAlbumsResult = await syncTopAlbums(languages, 5)
  results.push(topAlbumsResult)

  const totalStats = {
    songsAdded: results.reduce((sum, r) => sum + r.songsAdded, 0),
    songsSkipped: results.reduce((sum, r) => sum + r.songsSkipped, 0),
    errors: results.reduce((sum, r) => sum + r.errors, 0),
    apiCalls: results.reduce((sum, r) => sum + r.apiCalls, 0),
    durationSeconds: parseFloat(((Date.now() - startTime) / 1000).toFixed(2)),
    type: "full",
    breakdown: results,
  }

  console.log(`[MusicSync] FULL sync completed:`, {
    songsAdded: totalStats.songsAdded,
    songsSkipped: totalStats.songsSkipped,
    apiCalls: totalStats.apiCalls,
    duration: `${totalStats.durationSeconds}s`,
  })

  return totalStats
}

async function getSyncStats() {
  const totalSongs = await Song.count()
  const languageStats = await Song.findAll({
    attributes: ["language", [require("sequelize").fn("COUNT", "*"), "count"]],
    group: ["language"],
    raw: true,
  })

  const recentSongs = await Song.count({
    where: {
      createdAt: {
        [require("sequelize").Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
  })

  return {
    totalSongs,
    songsAddedLast24h: recentSongs,
    byLanguage: languageStats.reduce((acc, { language, count }) => {
      acc[language || "unknown"] = parseInt(count)
      return acc
    }, {}),
    availableArtists: POPULAR_ARTISTS.map((a) => ({ id: a.id, name: a.name })),
    availableQueries: SEARCH_QUERIES,
  }
}

let syncInterval = null
let lastSyncResult = null

function startScheduledSync(intervalHours = SYNC_INTERVAL_HOURS, mode = "modules") {
  if (syncInterval) {
    clearInterval(syncInterval)
  }

  const intervalMs = intervalHours * 60 * 60 * 1000
  console.log(`[MusicSync] Starting scheduled ${mode} sync every ${intervalHours} hours`)

  const runSync = async () => {
    try {
      if (mode === "full") {
        lastSyncResult = await syncFull()
      } else {
        lastSyncResult = await syncModulesData()
      }
    } catch (err) {
      console.error("[MusicSync] Scheduled sync failed:", err)
    }
  }

  runSync()

  syncInterval = setInterval(runSync, intervalMs)

  return syncInterval
}

function stopScheduledSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
    console.log("[MusicSync] Stopped scheduled sync")
  }
}

function getLastSyncResult() {
  return lastSyncResult
}

module.exports = {
  syncModulesData,
  syncArtistCatalogs,
  syncArtistDeepCatalog,
  syncSearchQueries,
  syncFeaturedPlaylists,
  syncTopAlbums,
  syncFull,
  getSyncStats,
  startScheduledSync,
  stopScheduledSync,
  getLastSyncResult,
  fetchModulesData,
  fetchAlbumSongs,
  fetchPlaylistSongs,
  POPULAR_ARTISTS,
  SEARCH_QUERIES,
}
