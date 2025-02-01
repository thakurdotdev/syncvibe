const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../utils/sequelize");

class Music extends Model {}

Music.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.TEXT(),
      allowNull: true,
    },
    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    artist: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    duration: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    postedtime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Music",
    timestamps: false,
    tableName: "musics",
    indexes: [
      {
        fields: ["postedtime", "id"],
        using: "BTREE",
      },
    ],
  },
);

// Music.sync({ alter: true }).then(() => console.log("Story table created"));

module.exports = Music;
