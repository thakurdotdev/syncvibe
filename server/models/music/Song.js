const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")

class Song extends Model {
  static extractArtistNames(songData) {
    const artists =
      songData?.artist_map?.artists ||
      songData?.artist_map?.primary_artists ||
      songData?.artists ||
      []

    if (!Array.isArray(artists)) return "Unknown"

    return (
      artists
        .map((a) => a?.name)
        .filter(Boolean)
        .slice(0, 4)
        .join(", ") || "Unknown"
    )
  }

  static async getOrCreate(songData) {
    if (!songData?.id) throw new Error("songData.id is required")

    try {
      return await Song.create({
        songId: songData.id,
        name: songData.name || songData.title || "Unknown",
        artistNames: Song.extractArtistNames(songData),
        albumName: songData.album?.name || songData.album_name || songData.album || null,
        language: songData.language || "unknown",
        duration: songData.duration || 0,
        songData,
      })
    } catch (err) {
      if (err.name === "SequelizeUniqueConstraintError") {
        return Song.findOne({ where: { songId: songData.id } })
      }
      throw err
    }
  }

  static async bulkGetOrCreate(songsData) {
    if (!songsData?.length) return { created: 0, skipped: 0 }

    const records = songsData
      .filter((s) => s?.id)
      .map((songData) => ({
        songId: songData.id,
        name: songData.name || songData.title || "Unknown",
        artistNames: Song.extractArtistNames(songData),
        albumName: songData.album?.name || songData.album_name || songData.album || null,
        language: songData.language || "unknown",
        duration: songData.duration || 0,
        songData,
      }))

    const result = await Song.bulkCreate(records, {
      ignoreDuplicates: true,
      returning: false,
    })

    return { created: result.length, total: records.length }
  }
}

Song.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    songId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      comment: "External song ID from Saavn/API",
    },
    name: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Song name (indexed for search)",
    },
    artistNames: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Comma-separated artist names (indexed for search)",
    },
    albumName: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: "Album name (indexed for search)",
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "Song language (indexed for filtering)",
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Duration in seconds",
    },
    songData: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: "Complete song object with all fields (image, download_url, artist_map, etc.)",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    timestamps: true,
    tableName: "songs",
    modelName: "Song",
  },
)

module.exports = Song
