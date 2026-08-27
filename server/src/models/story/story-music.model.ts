import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class StoryMusic extends Model<InferAttributes<StoryMusic>, InferCreationAttributes<StoryMusic>> {
  declare id: CreationOptional<number>;
  declare title: string | null;
  declare mediaUrl: string | null;
  declare artist: string | null;
  declare duration: string | null;
  declare postedtime: CreationOptional<Date>;
}

StoryMusic.init(
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
    modelName: 'Music',
    timestamps: false,
    tableName: 'musics',
    indexes: [
      {
        fields: ['postedtime', 'id'],
        using: 'BTREE',
      },
    ],
  }
);

export default StoryMusic;
