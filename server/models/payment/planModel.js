const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")

class Plan extends Model {}

Plan.init(
  {
    planid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true, // FREE, PRO
    },

    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    maxGroupMembers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    realtimeChatEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    realtimeSyncEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Plan",
    tableName: "plans",
    timestamps: false,
  },
)

module.exports = Plan
