import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import LikeDislike from './like-dislike.model';
import Comment from './comment.model';

export interface ImageEntry {
  url: string;
  public_id?: string;
  type?: string;
}

class Post extends Model<InferAttributes<Post>, InferCreationAttributes<Post>> {
  declare postid: CreationOptional<number>;
  declare title: string | null;
  declare createdby: number;
  declare images: ImageEntry[] | null;
  declare postedtime: CreationOptional<Date>;
  declare showpost: CreationOptional<boolean>;
}

Post.init(
  {
    postid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdby: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    postedtime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    showpost: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'Post',
    timestamps: false,
    tableName: 'posts',
    indexes: [
      {
        fields: ['createdby', 'postedtime'],
        using: 'BTREE',
      },
    ],
  }
);

Post.hasMany(LikeDislike, { foreignKey: 'postid', as: 'likes' });
Post.hasMany(Comment, { foreignKey: 'postid', as: 'comments' });

export default Post;
