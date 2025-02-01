const {
  createPlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  getPlaylists,
  getPlaylistSongs,
  deletePlaylist,
  updatePlaylist,
} = require("../controllers/music/musicController");

const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  addToHistory,
  getRecentlyPlayed,
  getMostPlayed,
  getPersonalizedRecommendations,
  updateLikeStatus,
} = require("../controllers/music/historyController.js");

const musicRoutes = express.Router();

musicRoutes.post("/playlist/create", authMiddleware, createPlaylist);

musicRoutes.patch("/playlist/update", authMiddleware, updatePlaylist);

musicRoutes.delete("/playlist/delete", authMiddleware, deletePlaylist);

musicRoutes.post("/playlist/add-song", authMiddleware, addSongToPlaylist);

musicRoutes.post(
  "/playlist/remove-song",
  authMiddleware,
  removeSongFromPlaylist,
);

musicRoutes.get("/playlist/get", authMiddleware, getPlaylists);

musicRoutes.get("/playlist/details", authMiddleware, getPlaylistSongs);

musicRoutes.post("/history/add", authMiddleware, addToHistory);
musicRoutes.get(
  "/music/recommendations",
  authMiddleware,
  getPersonalizedRecommendations,
);
musicRoutes.post("/history/like", authMiddleware, updateLikeStatus);

module.exports = musicRoutes;
