import {
  DataTypes,
  Op,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize';
import sequelize from '@/utils/sequelize';

class Chat extends Model<InferAttributes<Chat>, InferCreationAttributes<Chat>> {
  declare chatid: CreationOptional<number>;
  declare participants: number[];
  declare lastmessage: string | null;
  declare lastmessageType: string | null;
  declare createdat: CreationOptional<Date>;
  declare updatedat: CreationOptional<Date>;

  static findByParticipant(userId: number) {
    return Chat.findAll({
      where: {
        participants: {
          [Op.contains]: [userId],
        },
      },
      order: [['updatedat', 'DESC']],
    });
  }
}

Chat.init(
  {
    chatid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    participants: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      allowNull: false,
    },
    lastmessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastmessageType: {
      type: DataTypes.STRING,
      allowNull: true,
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
    modelName: 'Chat',
    timestamps: false,
    tableName: 'chats',
    indexes: [
      { fields: ['chatid'] },
      { fields: ['participants'], using: 'gin' },
      { fields: ['updatedat'] },
    ],
    hooks: {
      afterCreate: (chat) => {
        console.log('New chat created:', chat.chatid);
      },
      afterUpdate: (chat) => {
        console.log('Chat updated:', chat.chatid);
      },
    },
  }
);

export default Chat;
