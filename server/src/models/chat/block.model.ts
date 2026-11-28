import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

/** `blockerId` blocked `blockedId`: neither can message the other, and `blockedId` can't call. */
class ChatBlock extends Model<InferAttributes<ChatBlock>, InferCreationAttributes<ChatBlock>> {
  declare blockerId: number;
  declare blockedId: number;
  declare createdAt: CreationOptional<Date>;
}

ChatBlock.init(
  {
    blockerId: { type: DataTypes.INTEGER, field: 'blocker_id', primaryKey: true },
    blockedId: { type: DataTypes.INTEGER, field: 'blocked_id', primaryKey: true },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: 'ChatBlock', tableName: 'chat_blocks', timestamps: false }
);

export default ChatBlock;
