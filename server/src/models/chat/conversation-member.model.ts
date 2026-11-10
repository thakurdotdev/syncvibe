import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import { bigint } from './bigint';

class ConversationMember extends Model<
  InferAttributes<ConversationMember>,
  InferCreationAttributes<ConversationMember>
> {
  declare conversationId: number;
  declare userId: number;
  /** Everything up to and including this message has been read by this member. */
  declare lastReadMessageId: CreationOptional<number>;
  declare lastReadAt: CreationOptional<Date | null>;
  /** Everything up to and including this message has reached one of this member's devices. */
  declare lastDeliveredMessageId: CreationOptional<number>;
  declare lastDeliveredAt: CreationOptional<Date | null>;
  declare joinedAt: CreationOptional<Date>;
}

ConversationMember.init(
  {
    conversationId: { ...bigint('conversationId', 'conversation_id'), primaryKey: true },
    userId: { type: DataTypes.INTEGER, field: 'user_id', primaryKey: true },
    lastReadMessageId: {
      ...bigint('lastReadMessageId', 'last_read_message_id'),
      allowNull: false,
      defaultValue: 0,
    },
    lastReadAt: { type: DataTypes.DATE, field: 'last_read_at' },
    lastDeliveredMessageId: {
      ...bigint('lastDeliveredMessageId', 'last_delivered_message_id'),
      allowNull: false,
      defaultValue: 0,
    },
    lastDeliveredAt: { type: DataTypes.DATE, field: 'last_delivered_at' },
    joinedAt: {
      type: DataTypes.DATE,
      field: 'joined_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: 'ConversationMember', tableName: 'chat_members', timestamps: false }
);

export default ConversationMember;
