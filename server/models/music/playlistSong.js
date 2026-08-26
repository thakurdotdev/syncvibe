const { DataTypes } = require('sequelize');
const sequelize = require('../../utils/sequelize');

const PlaylistSong = sequelize.define(
  'PlaylistSong',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    playlistId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'playlists',
        key: 'id',
      },
    },
    // NEW: Reference to central Song table
    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Nullable during migration
      references: {
        model: 'songs',
        key: 'id',
      },
    },
    // DEPRECATED: Will be removed after migration
    songId: {
      type: DataTypes.STRING(255),
      allowNull: true, // Made nullable for new records
    },
    songData: {
      type: DataTypes.JSON,
      allowNull: true, // Made nullable for new records
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
    tableName: 'playlist_songs',
    indexes: [
      {
        fields: ['playlistId', 'songRefId'],
        unique: true,
      },
    ],
  }
);

module.exports = PlaylistSong;
