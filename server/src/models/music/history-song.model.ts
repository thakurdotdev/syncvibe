import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class HistorySong extends Model<
  InferAttributes<HistorySong>,
  InferCreationAttributes<HistorySong>
> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare songRefId: number;
  declare playedCount: CreationOptional<number>;
  declare playedTime: number | null;
  declare totalPlayTime: number | null;
  declare completionRate: CreationOptional<number>;
  declare skipCount: CreationOptional<number>;
  declare likeStatus: CreationOptional<boolean>;
  declare mood: string | null;
  declare timeOfDay: string | null;
  declare deviceType: string | null;
  declare tags: CreationOptional<string[]>;
  declare lastPlayedAt: CreationOptional<Date>;
  declare createdat: CreationOptional<Date>;
}

HistorySong.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'userid' },
    },
    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'songs', key: 'id' },
    },
    playedCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    playedTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    totalPlayTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    completionRate: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
    skipCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    likeStatus: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    mood: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    timeOfDay: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deviceType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tags: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    lastPlayedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'history_songs',
    modelName: 'HistorySong',
    timestamps: false,
    indexes: [
      { unique: true, fields: ['userId', 'songRefId'] },
      { fields: ['userId', 'lastPlayedAt'] },
      { fields: ['userId', 'likeStatus'] },
      { fields: ['userId', 'playedCount'] },
    ],
  }
);

export default HistorySong;
