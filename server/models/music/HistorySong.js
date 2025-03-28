const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../utils/sequelize");

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
    songId: {
      type: DataTypes.STRING(255),
      allowNull: false,
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
      allowNull: false,
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
      {
        fields: ["userId", "songId"],
        unique: true,
      },
    ],
  },
);

// HistorySong.sync({ alter: true }).then(() => {
//   console.log("HistorySong table created");
// });

module.exports = HistorySong;
