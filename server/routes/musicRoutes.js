const {
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylists,
  getPlaylistSongs,
  deletePlaylist,
  updatePlaylist,
} = require("../controllers/music/musicController")

const express = require("express")
const authMiddleware = require("../middleware/authMiddleware")
const {
  addToHistory,
  getPersonalizedRecommendations,
  updateLikeStatus,
  getHistorySongs,
  batchAddToHistory,
} = require("../controllers/music/historyController.js")
const { searchSongs } = require("../controllers/music/searchController.js")
const {
  syncModulesData,
  syncArtistCatalogs,
  syncArtistDeepCatalog,
  syncSearchQueries,
  syncFeaturedPlaylists,
  syncTopAlbums,
  syncByPlaylistIds,
  syncByAlbumIds,
  syncFull,
  getSyncStats,
  getLastSyncResult,
  POPULAR_ARTISTS,
  SEARCH_QUERIES,
} = require("../services/musicSyncService")
const { getPlayNextSongs, rebuildAllPlayNext } = require("../services/playNextService")

const musicRoutes = express.Router()

musicRoutes.post("/playlist/create", authMiddleware, createPlaylist)
musicRoutes.patch("/playlist/update", authMiddleware, updatePlaylist)
musicRoutes.delete("/playlist/delete", authMiddleware, deletePlaylist)
musicRoutes.post("/playlist/add-song", authMiddleware, addSongToPlaylist)
musicRoutes.post("/playlist/remove-song", authMiddleware, removeSongFromPlaylist)
musicRoutes.get("/playlist/get", authMiddleware, getPlaylists)
musicRoutes.get("/playlist/details", authMiddleware, getPlaylistSongs)
musicRoutes.post("/history/add", authMiddleware, addToHistory)
musicRoutes.post("/history/batch", authMiddleware, batchAddToHistory)
musicRoutes.get("/music/recommendations", authMiddleware, getPersonalizedRecommendations)
musicRoutes.post("/history/like", authMiddleware, updateLikeStatus)
musicRoutes.get("/music/latestHistory", authMiddleware, getHistorySongs)
musicRoutes.get("/music/search", searchSongs)

musicRoutes.post("/sync", async (req, res) => {
  try {
    const { languages = ["hindi"], bypassCache = false } = req.body
    const stats = await syncModulesData(languages, bypassCache)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/artists", async (req, res) => {
  try {
    const { artistIds, limit } = req.body
    const stats = await syncArtistCatalogs(artistIds, limit || 50)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Artist sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/artist-deep", async (req, res) => {
  try {
    const { artistId, pages } = req.body
    if (!artistId) {
      return res.status(400).json({ success: false, error: "artistId is required" })
    }
    const stats = await syncArtistDeepCatalog(artistId, pages || 3)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Deep artist sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/search", async (req, res) => {
  try {
    const { queries, limit } = req.body
    const stats = await syncSearchQueries(queries, limit || 5)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Search sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/featured", async (req, res) => {
  try {
    const { languages, limit } = req.body
    const stats = await syncFeaturedPlaylists(languages || ["hindi"], limit || 5)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Featured sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/top-albums", async (req, res) => {
  try {
    const { languages, limit } = req.body
    const stats = await syncTopAlbums(languages || ["hindi"], limit || 5)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Top albums sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/playlists", async (req, res) => {
  try {
    const { playlistIds, bypassCache = false } = req.body
    if (!playlistIds?.length) {
      return res.status(400).json({ success: false, error: "playlistIds array is required" })
    }
    const stats = await syncByPlaylistIds(playlistIds, bypassCache)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Playlist sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/albums", async (req, res) => {
  try {
    const { albumIds, bypassCache = false } = req.body
    if (!albumIds?.length) {
      return res.status(400).json({ success: false, error: "albumIds array is required" })
    }
    const stats = await syncByAlbumIds(albumIds, bypassCache)
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Album sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/sync/full", async (req, res) => {
  try {
    const { languages } = req.body
    const stats = await syncFull({ languages: languages || ["hindi"] })
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Full sync failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.get("/sync/stats", async (req, res) => {
  try {
    const stats = await getSyncStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[MusicSync] Stats failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.get("/sync/status", async (req, res) => {
  try {
    const lastResult = getLastSyncResult()
    res.json({
      success: true,
      data: {
        lastSync: lastResult,
        availableArtists: POPULAR_ARTISTS,
        availableQueries: SEARCH_QUERIES,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

musicRoutes.get("/play-next/:songId", async (req, res) => {
  try {
    const { songId } = req.params

    if (!songId || typeof songId !== "string") {
      return res.status(400).json({ success: false, error: "Invalid songId" })
    }

    const limitRaw = parseInt(req.query.limit, 10)
    const limit = Math.min(Math.max(limitRaw || 20, 1), 50)

    const excludeSongIds = req.query.exclude
      ? req.query.exclude.split(",").map((s) => s.trim())
      : []

    const data = await getPlayNextSongs({
      baseSongId: songId,
      limit,
      excludeSongIds,
    })
    res.set(
      "Cache-Control",
      data.length > 0
        ? "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800"
        : "no-store",
    )
    return res.json({ success: true, data })
  } catch (error) {
    console.error("[PlayNext] Error:", error.message)
    if (res.headersSent) return
    const status = error.message.includes("not found") ? 404 : 500
    res.set("Cache-Control", "no-store")
    return res.status(status).json({ success: false, error: error.message })
  }
})

musicRoutes.post("/play-next/rebuild", async (req, res) => {
  try {
    const stats = await rebuildAllPlayNext()
    res.json({ success: true, data: stats })
  } catch (error) {
    console.error("[PlayNext] Rebuild failed:", error)
    res.status(500).json({ success: false, error: error.message })
  }
})

module.exports = musicRoutes
