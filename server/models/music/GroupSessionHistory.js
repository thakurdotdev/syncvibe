const { DataTypes } = require("sequelize")
const sequelize = require("../../utils/sequelize")

const GroupSessionHistory = sequelize.define(
  "GroupSessionHistory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    groupId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "songs",
        key: "id",
      },
    },
    addedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "userid",
      },
    },
    playedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    reactionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "GroupSessionHistory",
    tableName: "group_session_history",
    timestamps: true,
    indexes: [
      { fields: ["groupId", "sessionId"] },
      { fields: ["addedByUserId"] },
      { fields: ["playedAt"] },
    ],
  },
)

module.exports = GroupSessionHistory
