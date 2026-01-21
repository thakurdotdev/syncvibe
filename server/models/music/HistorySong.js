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

    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "songs",
        key: "id",
      },
    },

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

    completionRate: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },

    skipCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    likeStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    mood: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    timeOfDay: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    deviceType: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
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
    tableName: "history_songs",
    modelName: "HistorySong",
    timestamps: false,

    indexes: [
      // ONE history row per user per song
      {
        unique: true,
        fields: ["userId", "songRefId"],
      },

      // Fast history listing
      {
        fields: ["userId", "lastPlayedAt"],
      },

      // Likes page
      {
        fields: ["userId", "likeStatus"],
      },

      // Recommendation scan
      {
        fields: ["userId", "playedCount"],
      },
    ],
  },
)

module.exports = HistorySong
