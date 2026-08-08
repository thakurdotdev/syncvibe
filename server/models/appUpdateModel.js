const { DataTypes, Model } = require("sequelize")
const sequelize = require("../utils/sequelize")

class AppUpdate extends Model { }

AppUpdate.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    version: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    releaseNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    downloadUrl: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    critical: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    sha256: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
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
    modelName: "AppUpdate",
    tableName: "app_updates",
    timestamps: true,
  },
)

module.exports = AppUpdate
