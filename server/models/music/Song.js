const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../utils/sequelize');

/**
 * Central Song model - stores unique songs with full songData JSON.
 * Indexed columns are extracted for efficient querying, but the
 * complete song object is always read from the songData column.
 */
class Song extends Model {
  /**
   * Extract artist names from songData for indexing
   */
  static extractArtistNames(songData) {
    const artists =
      songData?.artist_map?.artists ||
      songData?.artist_map?.primary_artists ||
      songData?.artists ||
      [];

    if (!Array.isArray(artists)) return 'Unknown';

    return (
      artists
        .map((a) => a?.name)
        .filter(Boolean)
        .slice(0, 4)
        .join(', ') || 'Unknown'
    );
  }

  /**
   * Get or create a song in the central table
   * @param {Object} songData - Full song object from API
   * @returns {Promise<Song>} The song record
   */
  static async getOrCreate(songData) {
    if (!songData?.id) {
      throw new Error('songData.id is required');
    }

    const [song] = await Song.findOrCreate({
      where: { songId: songData.id },
      defaults: {
        songId: songData.id,
        name: songData.name || songData.title || 'Unknown',
        artistNames: Song.extractArtistNames(songData),
        language: songData.language || 'unknown',
        duration: songData.duration || 0,
        songData: songData,
      },
    });

    return song;
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
      comment: 'External song ID from Saavn/API',
    },
    // Indexed columns for efficient queries
    name: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Song name (indexed for search)',
    },
    artistNames: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Comma-separated artist names (indexed for search)',
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Song language (indexed for filtering)',
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration in seconds',
    },
    // Full song data - THE SOURCE OF TRUTH
    songData: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'Complete song object with all fields (image, download_url, artist_map, etc.)',
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
    tableName: 'songs',
    modelName: 'Song',
    indexes: [
      { fields: ['songId'], unique: true },
      { fields: ['name'] },
      { fields: ['artistNames'] },
      { fields: ['language'] },
    ],
  }
);

module.exports = Song;
