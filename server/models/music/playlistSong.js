const { DataTypes } = require('sequelize');
const sequelize = require('../../utils/sequelize');

const PlaylistSong = sequelize.define(
  'Playlist',
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
    songId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    songData: {
      type: DataTypes.JSON,
      allowNull: false,
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
  }
);

// PlaylistSong.sync({ alter: true }).then(() => {
//   console.log("PlaylistSong table created");
// });

module.exports = PlaylistSong;
