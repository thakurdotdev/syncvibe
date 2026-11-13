import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import { bigint } from './bigint';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'file';
export type AttachmentStatus = 'pending' | 'sent' | 'deleted';

/**
 * A file uploaded to a conversation, kept in the private chat bucket. 'pending' from when the
 * device is given somewhere to upload it until a message carries it ('sent'); 'deleted' with its
 * message. Uploads never sent are removed after a while.
 */
class ChatAttachment extends Model<
  InferAttributes<ChatAttachment>,
  InferCreationAttributes<ChatAttachment>
> {
  declare id: string;
  declare conversationId: number;
  declare uploaderId: number;
  declare messageId: CreationOptional<number | null>;
  declare storageKey: string;
  declare kind: AttachmentKind;
  declare name: string;
  declare mime: string;
  declare size: number;
  declare width: CreationOptional<number | null>;
  declare height: CreationOptional<number | null>;
  declare durationSec: CreationOptional<number | null>;
  declare status: CreationOptional<AttachmentStatus>;
  declare createdAt: CreationOptional<Date>;
}

ChatAttachment.init(
  {
    id: { type: DataTypes.UUID, primaryKey: true },
    conversationId: { ...bigint('conversationId', 'conversation_id'), allowNull: false },
    uploaderId: { type: DataTypes.INTEGER, field: 'uploader_id', allowNull: false },
    messageId: bigint('messageId', 'message_id'),
    storageKey: { type: DataTypes.STRING(200), field: 'storage_key', allowNull: false },
    kind: { type: DataTypes.STRING(16), allowNull: false },
    name: { type: DataTypes.STRING(160), allowNull: false },
    mime: { type: DataTypes.STRING(127), allowNull: false },
    size: { ...bigint('size'), allowNull: false },
    width: { type: DataTypes.INTEGER },
    height: { type: DataTypes.INTEGER },
    durationSec: { type: DataTypes.INTEGER, field: 'duration_sec' },
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'pending' },
    createdAt: {
      type: DataTypes.DATE,
      field: 'created_at',
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ChatAttachment',
    tableName: 'chat_attachments',
    timestamps: false,
  }
);

export default ChatAttachment;
