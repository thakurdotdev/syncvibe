const { DataTypes } = require("sequelize")
const sequelize = require("../../utils/sequelize")
const PlaylistSong = require("./playlistSong")

const Playlist = sequelize.define(
  "Playlist",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
    tableName: "playlists",
  },
)

// Define associations
Playlist.hasMany(PlaylistSong, {
  foreignKey: "playlistId",
  as: "latestSong", // Alias used for the relationship
})

Playlist.hasMany(PlaylistSong, {
  foreignKey: "playlistId",
  as: "songs", // Alias used for the relationship
})

PlaylistSong.belongsTo(Playlist, {
  foreignKey: "playlistId",
})

// PlaylistSong.sync({ alter: true }).then(() => {
//   console.log("Playlist table created");
// });

// Export the model
module.exports = Playlist
