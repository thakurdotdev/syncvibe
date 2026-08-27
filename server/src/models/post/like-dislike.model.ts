import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class LikeDislike extends Model<
  InferAttributes<LikeDislike>,
  InferCreationAttributes<LikeDislike>
> {
  declare id: CreationOptional<number>;
  declare userid: number;
  declare postid: number;
  declare liked: CreationOptional<boolean>;
  declare createdat: CreationOptional<Date>;
  declare updatedat: CreationOptional<Date>;
}

LikeDislike.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    postid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    liked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    createdat: {
      type: DataTypes.DATE,
    },
    updatedat: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    modelName: 'LikeDislike',
    timestamps: true,
    tableName: 'likedislikes',
    createdAt: 'createdat',
    updatedAt: 'updatedat',
  }
);

export default LikeDislike;
