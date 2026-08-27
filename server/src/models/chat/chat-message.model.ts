import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';
import Chat from './chat.model';

class ChatMessage extends Model<
  InferAttributes<ChatMessage>,
  InferCreationAttributes<ChatMessage>
> {
  declare messageid: CreationOptional<number>;
  declare chatid: number;
  declare senderid: number;
  declare content: string | null;
  declare fileurl: string | null;
  declare isdeleted: CreationOptional<boolean>;
  declare isread: CreationOptional<boolean>;
  declare readat: Date | null;
  declare messagetype: CreationOptional<string>;
  declare createdat: CreationOptional<Date>;
  declare updatedat: CreationOptional<Date>;

  static async findLatestByChatId(chatId: number) {
    return ChatMessage.findOne({
      where: { chatid: chatId },
      order: [['createdat', 'DESC']],
    });
  }
}

ChatMessage.init(
  {
    messageid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    chatid: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'chats',
        key: 'chatid',
      },
    },
    senderid: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fileurl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isdeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    isread: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    readat: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    messagetype: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'text',
    },
    createdat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedat: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ChatMessage',
    timestamps: false,
    tableName: 'chatmessage',
    indexes: [
      { fields: ['chatid'] },
      { fields: ['createdat'] },
      { fields: ['chatid', 'createdat'] },
    ],
  }
);

ChatMessage.belongsTo(Chat, { foreignKey: 'chatid', as: 'Chat' });
Chat.hasMany(ChatMessage, { foreignKey: 'chatid', as: 'Messages' });

// sequelize
//   .query('ALTER TABLE chatmessage ADD COLUMN IF NOT EXISTS readat TIMESTAMP WITH TIME ZONE;')
//   .catch((err: Error) => console.error('Error ensuring readat column in chatmessage:', err.message));

export default ChatMessage;
