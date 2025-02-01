const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../utils/sequelize");

class Comment extends Model {}

Comment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    comment: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    postid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdby: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    parentCommentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "comments",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "Comment",
    timestamps: false,
    tableName: "comments",
  },
);

// Add self-referential association for nested comments
Comment.belongsTo(Comment, {
  as: "parentComment",
  foreignKey: "parentCommentId",
});

Comment.hasMany(Comment, {
  as: "childComments",
  foreignKey: "parentCommentId",
});

module.exports = Comment;
