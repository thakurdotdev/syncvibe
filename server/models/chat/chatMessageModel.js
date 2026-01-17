const { DataTypes, Model } = require("sequelize")
const sequelize = require("../../utils/sequelize")
const Chat = require("./chatModel")

class ChatMessage extends Model {
  static async findLatestByChatId(chatId) {
    return this.findOne({
      where: { chatid: chatId },
      order: [["createdat", "DESC"]],
    })
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
        model: "chats",
        key: "chatid",
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
    modelName: "ChatMessage",
    timestamps: false,
    tableName: "chatmessage",
    indexes: [
      {
        fields: ["chatid"],
      },
      {
        fields: ["createdat"],
      },
      {
        fields: ["chatid", "createdat"],
      },
    ],
  },
)

ChatMessage.belongsTo(Chat, {
  foreignKey: "chatid",
  as: "Chat",
})

Chat.hasMany(ChatMessage, {
  foreignKey: "chatid",
  as: "Messages",
})

// ChatMessage.sync({ alter: true });

module.exports = ChatMessage
