const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")

class HistorySong extends Model {}

HistorySong.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "userid",
      },
    },
    // NEW: Reference to central Song table
    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Nullable during migration
      references: {
        model: "songs",
        key: "id",
      },
    },
    // DEPRECATED: Will be removed after migration (use Song association instead)
    songId: {
      type: DataTypes.STRING(255),
      allowNull: true, // Made nullable for new records
    },
    songName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    artistNames: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    songLanguage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    songData: {
      type: DataTypes.JSON,
      allowNull: true, // Made nullable for new records
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: true, // Made nullable for new records
    },
    // User-specific listening data (keep these)
    playedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    playedTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    totalPlayTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mood: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    timeOfDay: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    skipCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    completionRate: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    deviceType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    likeStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    aiRecommendationScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    lastPlayedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    timestamps: false,
    tableName: "history_songs",
    modelName: "HistorySong",
    indexes: [
      // Primary lookup index
      {
        fields: ["userId", "songRefId"],
        unique: true,
      },
      // Backward compatibility
      {
        fields: ["userId", "songId"],
      },
      // Fast history listing (sorted by lastPlayedAt)
      {
        fields: ["userId", "lastPlayedAt"],
      },
      // Recommendations query optimization
      {
        fields: ["userId", "aiRecommendationScore"],
      },
      // Liked songs quick lookup
      {
        fields: ["userId", "likeStatus"],
      },
      // PlayedCount for recommendations
      {
        fields: ["userId", "playedCount"],
      },
    ],
  },
)

// Association with Song (will be set up in associations file)
// HistorySong.belongsTo(Song, { foreignKey: 'songRefId', as: 'song' });

module.exports = HistorySong
