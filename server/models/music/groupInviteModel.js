const { DataTypes } = require("sequelize")
const sequelize = require("../../utils/sequelize")

const GroupInvite = sequelize.define(
  "GroupInvite",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    groupId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    groupName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    inviterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    inviterName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    inviterPic: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    inviteeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "accepted", "declined", "expired"),
      defaultValue: "pending",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "GroupInvite",
    tableName: "group_invites",
    timestamps: true,
    indexes: [
      { fields: ["inviteeId", "status"] },
      { fields: ["groupId", "inviteeId"] },
    ],
  },
)

module.exports = GroupInvite

GroupInvite.sync({ alter: true }).then(() => {
  console.log("GroupInvite table synced")
}).catch((err) => {
  console.error("GroupInvite sync error:", err)
})
