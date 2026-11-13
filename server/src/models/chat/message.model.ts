import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import { bigint } from './bigint';

export type MessageType = 'text' | 'image' | 'file' | 'call';

/** A file in the private chat bucket, as the message keeps it. Links are signed when shown. */
export interface StoredFile {
  /** The chat_attachments row. */
  id: string;
  key: string;
  kind: 'image' | 'video' | 'audio' | 'file';
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

/** A photo sent before files moved to R2: a public Cloudinary address. */
export interface LegacyPhoto {
  url: string;
  width?: number;
  height?: number;
}

export type MessageAttachment = StoredFile | LegacyPhoto;

export const isStoredFile = (attachment: MessageAttachment | null): attachment is StoredFile =>
  Boolean(attachment && 'key' in attachment);

export interface CallMeta {
  outcome: 'missed' | 'completed' | 'rejected';
  durationSec?: number;
}

class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<number>;
  declare conversationId: number;
  declare senderId: number;
  /** Chosen by the sending device, so a message sent again after a lost reply isn't stored twice. */
  declare clientId: string;
  declare type: CreationOptional<MessageType>;
  declare body: CreationOptional<string | null>;
  declare attachment: CreationOptional<MessageAttachment | null>;
  declare meta: CreationOptional<CallMeta | null>;
  declare replyToId: CreationOptional<number | null>;
  declare editedAt: CreationOptional<Date | null>;
  /** A deleted message keeps its row (replies still point at it) but loses its content. */
  declare deletedAt: CreationOptional<Date | null>;
  declare createdAt: CreationOptional<Date>;
}

Message.init(
  {
    id: { ...bigint('id'), primaryKey: true, autoIncrement: true },
    conversationId: { ...bigint('conversationId', 'conversation_id'), allowNull: false },
    senderId: { type: DataTypes.INTEGER, field: 'sender_id', allowNull: false },
    clientId: { type: DataTypes.STRING(64), field: 'client_id', allowNull: false },
    type: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'text' },
    body: { type: DataTypes.TEXT },
    attachment: { type: DataTypes.JSONB },
    meta: { type: DataTypes.JSONB },
    replyToId: bigint('replyToId', 'reply_to_id'),
    editedAt: { type: DataTypes.DATE, field: 'edited_at' },
    deletedAt: { type: DataTypes.DATE, field: 'deleted_at' },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Message',
    tableName: 'chat_messages',
    timestamps: false,
    indexes: [{ unique: true, fields: ['sender_id', 'client_id'] }],
  }
);

export default Message;
