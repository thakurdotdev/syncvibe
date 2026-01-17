const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")

class Story extends Model {}

Story.init(
  {
    storyid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    createdby: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mediaType: {
      type: DataTypes.ENUM("image", "video"),
      allowNull: true,
    },
    views: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
      defaultValue: [],
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    postedtime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Story",
    timestamps: false,
    tableName: "stories",
    indexes: [
      {
        fields: ["createdby", "postedtime"],
        using: "BTREE",
      },
    ],
  },
)

// Story.sync({ alter: true }).then(() => console.log("Story table created"));

module.exports = Story
