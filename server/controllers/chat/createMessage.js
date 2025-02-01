const ChatMessage = require("../../models/chat/chatMessageModel");
const Chat = require("../../models/chat/chatModel");
const cloudinary = require("cloudinary").v2;
const getDataUri = require("../../utils/dataUri");

const createMessage = async (req, res) => {
  try {
    const { chatid, content } = req.body;
    const { userid: senderid } = req.user;

    if (!chatid || !senderid || (!content && !req.file)) {
      return res.status(400).json({
        message: "At least one of content or files is required",
      });
    }

    let fileUrl = null;

    if (req.file) {
      const dataUri = getDataUri(req.file);
      const cloudinaryResponse = await cloudinary.uploader.upload(
        dataUri.content,
      );
      fileUrl = cloudinaryResponse.secure_url;
    }

    const newMessage = await ChatMessage.create({
      chatid,
      senderid,
      content: content || null,
      fileurl: fileUrl,
    });

    const lastMessageContent = content || "File shared";
    const updateRes = await Chat.update(
      { lastmessage: lastMessageContent, updatedat: new Date() },
      { where: { chatid } },
    );

    if (!updateRes) {
      return res.status(500).json({
        message: "An error occurred while updating the chat.",
      });
    }

    return res.status(200).json({ message: "success", message: newMessage });
  } catch (error) {
    console.error("Error creating message:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while creating a message." });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const { messageid } = req.params;
    const { userid } = req.user;

    const message = await ChatMessage.findOne({
      where: { messageid },
    });

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (message.senderid !== userid) {
      return res
        .status(403)
        .json({ message: "You cannot delete this message" });
    }

    await ChatMessage.update({ isdeleted: true }, { where: { messageid } });

    return res.status(200).json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res
      .status(500)
      .json({ error: "An error occurred while deleting a message." });
  }
};

module.exports = { createMessage, deleteMessage };
