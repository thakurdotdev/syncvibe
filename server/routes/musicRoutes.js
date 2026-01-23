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
  syncFull,
  getSyncStats,
  getLastSyncResult,
  POPULAR_ARTISTS,
  SEARCH_QUERIES,
} = require("../services/musicSyncService")

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
    const languages = req.body.languages || ["hindi"]
    const stats = await syncModulesData(languages)
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

module.exports = musicRoutes
