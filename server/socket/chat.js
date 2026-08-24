const { sendPushNotification } = require("./notification")

const setupChatHandlers = (io, socket, context) => {
  const { userSockets, onlineUsers } = context

  socket.on("join-chat", (room) => {
    if (!room || !socket.userId) return
    socket.join(String(room))
  })

  socket.on("new-message", (messageData) => {
    if (!socket.userId) return

    try {
      const { senderid, participants } = messageData
      if (!senderid || !participants?.length) return

      const recipientId = participants.find((p) => String(p) !== String(senderid))
      if (!recipientId) return

      const recipientSocket = userSockets.get(recipientId)
      const isRecipientOnline = recipientSocket && onlineUsers.has(recipientId)

      if (!isRecipientOnline) {
        sendPushNotification(recipientId, messageData)
      }

      io.to(String(recipientId)).emit("message-received", messageData)
    } catch (error) {
      console.error("new-message error:", error)
    }
  })

  socket.on("delete-message", (messageData) => {
    if (!socket.userId) return

    try {
      const { recipientId } = messageData
      if (!recipientId) return

      io.to(String(recipientId)).emit("message-deleted", messageData)
    } catch (error) {
      console.error("delete-message error:", error)
    }
  })

  socket.on("typing", (data) => {
    if (!socket.userId) return

    try {
      const { recipientId, isTyping } = data
      if (!recipientId) return

      io.to(String(recipientId)).emit("typing_status", { userId: socket.userId, isTyping })
    } catch (error) {
      console.error("typing error:", error)
    }
  })

  socket.on("messages-read", (data) => {
    if (!socket.userId) return

    try {
      const { messageIds, chatid, senderId } = data
      if (!messageIds?.length || !chatid || !senderId) return

      const sanitizedIds = messageIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0)
      if (sanitizedIds.length === 0) return

      io.to(String(senderId)).emit("messages-read-status", {
        messageIds: sanitizedIds,
        chatid: Number(chatid),
        readerId: socket.userId,
      })
    } catch (error) {
      console.error("messages-read error:", error)
    }
  })
}

module.exports = {
  setupChatHandlers,
}
