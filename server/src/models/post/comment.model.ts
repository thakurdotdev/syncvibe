import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Comment extends Model<InferAttributes<Comment>, InferCreationAttributes<Comment>> {
  declare id: CreationOptional<number>;
  declare comment: string;
  declare postid: number;
  declare createdby: number;
  declare createdat: CreationOptional<Date>;
  declare parentCommentId: number | null;
}

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
        model: 'comments',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'Comment',
    timestamps: false,
    tableName: 'comments',
  }
);

Comment.belongsTo(Comment, {
  as: 'parentComment',
  foreignKey: 'parentCommentId',
});

Comment.hasMany(Comment, {
  as: 'childComments',
  foreignKey: 'parentCommentId',
});

export default Comment;
