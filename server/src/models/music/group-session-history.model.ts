import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class GroupSessionHistory extends Model<
  InferAttributes<GroupSessionHistory>,
  InferCreationAttributes<GroupSessionHistory>
> {
  declare id: CreationOptional<number>;
  declare sessionId: string;
  declare groupId: string;
  declare songRefId: number;
  declare addedByUserId: number | null;
  declare playedAt: CreationOptional<Date>;
  declare reactionCount: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

GroupSessionHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sessionId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    groupId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    songRefId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'songs', key: 'id' },
    },
    addedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'userid' },
    },
    playedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    reactionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'GroupSessionHistory',
    tableName: 'group_session_history',
    timestamps: true,
    indexes: [
      { fields: ['groupId', 'sessionId'] },
      { fields: ['addedByUserId'] },
      { fields: ['playedAt'] },
    ],
  }
);

export default GroupSessionHistory;
