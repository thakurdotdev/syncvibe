/**
 * Music Model Associations
 * Sets up relationships between Song, HistorySong, PlaylistSong, and Playlist
 */

const Song = require('./Song');
const HistorySong = require('./HistorySong');
const PlaylistSong = require('./playlistSong');
const Playlist = require('./playlist');

// Song -> HistorySong (one-to-many)
Song.hasMany(HistorySong, {
  foreignKey: 'songRefId',
  as: 'historyEntries',
});

HistorySong.belongsTo(Song, {
  foreignKey: 'songRefId',
  as: 'song',
});

// Song -> PlaylistSong (one-to-many)
Song.hasMany(PlaylistSong, {
  foreignKey: 'songRefId',
  as: 'playlistEntries',
});

PlaylistSong.belongsTo(Song, {
  foreignKey: 'songRefId',
  as: 'song',
});

// Playlist -> PlaylistSong associations are already in playlist.js
// Just re-export for convenience

module.exports = {
  Song,
  HistorySong,
  PlaylistSong,
  Playlist,
};
