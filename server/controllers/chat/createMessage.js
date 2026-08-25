const ChatMessage = require("../../models/chat/chatMessageModel")

const deleteMessage = async (req, res) => {
  try {
    const { messageid } = req.params
    const { userid } = req.user

    const message = await ChatMessage.findOne({
      where: { messageid },
    })

    if (!message) {
      return res.status(404).json({ message: "Message not found" })
    }

    if (message.senderid !== userid) {
      return res.status(403).json({ message: "You cannot delete this message" })
    }

    await ChatMessage.update({ isdeleted: true }, { where: { messageid } })

    return res.status(200).json({ message: "Message deleted" })
  } catch (error) {
    console.error("Error deleting message:", error)
    return res.status(500).json({ error: "An error occurred while deleting a message." })
  }
}

module.exports = { deleteMessage }
