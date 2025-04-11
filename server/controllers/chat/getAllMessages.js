const ChatMessage = require("../../models/chat/chatMessageModel");

const getAllMessages = async (req, res) => {
  try {
    const { chatid } = req.params;

    if (!chatid) {
      return res.status(400).json({ message: "Chatid is required" });
    }

    // Fetch all messages for the given chatId
    const messages = await ChatMessage.findAll({
      where: { chatid, isdeleted: false },
      order: [["createdat", "ASC"]],
    });

    return res.status(200).json({ message: "success", chats: messages });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while fetching messages." });
  }
};

const readMessage = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const { userid } = req.user;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res
        .status(400)
        .json({ message: "Valid array of message IDs is required" });
    }

    await ChatMessage.update(
      { isread: true },
      {
        where: {
          messageid: messageIds,
          isdeleted: false,
        },
      },
    );

    return res.status(200).json({
      message: "success",
      updatedCount: messageIds.length,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "An error occurred while reading the messages." });
  }
};

module.exports = { getAllMessages, readMessage };
