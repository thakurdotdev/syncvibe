const { DataTypes, Op } = require('sequelize');
const sequelize = require('../../utils/sequelize');

const Chat = sequelize.define(
  'Chat',
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
    timestamps: false,
    tableName: 'chats',
    indexes: [
      {
        fields: ['chatid'],
      },
      {
        fields: ['participants'],
        using: 'gin',
      },
      {
        fields: ['updatedat'],
      },
    ],
    hooks: {
      afterCreate: (chat, options) => {
        console.log('New chat created:', chat.chatid);
      },
      afterUpdate: (chat, options) => {
        console.log('Chat updated:', chat.chatid);
      },
    },
  }
);

// Chat.sync({ alter: true });

Chat.findByParticipant = function (userId) {
  return this.findAll({
    where: {
      participants: {
        [Op.contains]: [userId],
      },
    },
    order: [['updatedat', 'DESC']],
  });
};

module.exports = Chat;
