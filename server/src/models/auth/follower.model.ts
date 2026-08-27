import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

export interface FollowerAttributes {
  id: number;
  followerid: number;
  followid: number;
  createdat: Date | null;
}

class Follower extends Model<InferAttributes<Follower>, InferCreationAttributes<Follower>> {
  declare id: CreationOptional<number>;
  declare followerid: number;
  declare followid: number;
  declare createdat: CreationOptional<Date>;
}

Follower.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    followerid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    followid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    createdat: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Follower',
    timestamps: false,
    tableName: 'followers',
  }
);

export default Follower;
