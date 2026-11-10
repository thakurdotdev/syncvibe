import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import { bigint } from './bigint';

class Conversation extends Model<
  InferAttributes<Conversation>,
  InferCreationAttributes<Conversation>
> {
  declare id: CreationOptional<number>;
  declare type: CreationOptional<'direct'>;
  /** "<lower userid>:<higher userid>": two people can only ever have one conversation. */
  declare directKey: string | null;
  /** Orders the conversation list. Only ever moves forward. */
  declare lastMessageAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
}

Conversation.init(
  {
    id: { ...bigint('id'), primaryKey: true, autoIncrement: true },
    type: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'direct' },
    directKey: { type: DataTypes.STRING(48), field: 'direct_key', unique: true },
    lastMessageAt: { type: DataTypes.DATE, field: 'last_message_at' },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: 'Conversation', tableName: 'chat_conversations', timestamps: false }
);

export default Conversation;
