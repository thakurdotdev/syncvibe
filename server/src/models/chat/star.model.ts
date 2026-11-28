import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import { bigint } from './bigint';

/** A message `userId` starred. Only they see it. */
class ChatStar extends Model<InferAttributes<ChatStar>, InferCreationAttributes<ChatStar>> {
  declare userId: number;
  declare messageId: number;
  declare createdAt: CreationOptional<Date>;
}

ChatStar.init(
  {
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    messageId: { ...bigint('messageId', 'message_id'), primaryKey: true },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: 'ChatStar', tableName: 'chat_stars', timestamps: false }
);

export default ChatStar;
