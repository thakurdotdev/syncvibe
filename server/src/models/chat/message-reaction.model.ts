import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import { bigint } from './bigint';

/** One reaction per person per message; choosing another replaces it. */
class MessageReaction extends Model<
  InferAttributes<MessageReaction>,
  InferCreationAttributes<MessageReaction>
> {
  declare messageId: number;
  declare userId: number;
  declare emoji: string;
  declare createdAt: CreationOptional<Date>;
}

MessageReaction.init(
  {
    messageId: { ...bigint('messageId', 'message_id'), primaryKey: true },
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    emoji: { type: DataTypes.STRING(32), allowNull: false },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: 'MessageReaction', tableName: 'chat_reactions', timestamps: false }
);

export default MessageReaction;
