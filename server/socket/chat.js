const { Op } = require('sequelize');
const ChatMessage = require('../models/chat/chatMessageModel');
const Chat = require('../models/chat/chatModel');
const { sendPushNotification } = require('./notification');

const setupChatHandlers = (io, socket, context) => {
  const { userSockets, onlineUsers } = context;

  socket.on('join-chat', (room) => {
    if (!room || !socket.userId) return;
    socket.join(String(room));
  });

  socket.on('send-message', async (data) => {
    if (!socket.userId) return;

    const { tempId, chatid, content, fileurl } = data;
    if (!chatid || (!content && !fileurl)) {
      socket.emit('message-error', { tempId, error: 'Invalid message data' });
      return;
    }

    try {
      // Verify chat exists and sender is an authorized participant
      const chat = await Chat.findByPk(Number(chatid));
      const numericUserId = Number(socket.userId);
      if (
        !chat ||
        !Array.isArray(chat.participants) ||
        !chat.participants.map(Number).includes(numericUserId)
      ) {
        socket.emit('message-error', { tempId, error: 'Unauthorized chat access' });
        return;
      }

      const verifiedRecipientId = chat.participants.find((p) => Number(p) !== numericUserId);
      if (!verifiedRecipientId) {
        socket.emit('message-error', { tempId, error: 'Recipient not found in chat' });
        return;
      }

      const dbMessage = await ChatMessage.create({
        chatid: Number(chatid),
        senderid: socket.userId,
        content: content || null,
        fileurl: fileurl || null,
      });

      const lastMessageContent = content || 'Sent an attachment';
      await Chat.update(
        { lastmessage: lastMessageContent, updatedat: new Date() },
        { where: { chatid: Number(chatid) } }
      );

      const message = dbMessage.toJSON();

      // Ack sender with real DB message so they can replace the temp ID
      socket.emit('message-ack', { tempId, message });

      // Deliver strictly to the verified recipient's private room
      const recipientKey = String(verifiedRecipientId);
      io.to(recipientKey).emit('message-received', {
        ...message,
        senderName: data.senderName,
        participants: chat.participants,
      });

      // Push notification if recipient is offline
      const recipientSocket =
        userSockets.get(verifiedRecipientId) ||
        userSockets.get(Number(verifiedRecipientId)) ||
        userSockets.get(String(verifiedRecipientId));
      const isRecipientOnline =
        recipientSocket &&
        (onlineUsers.has(verifiedRecipientId) ||
          onlineUsers.has(Number(verifiedRecipientId)) ||
          onlineUsers.has(String(verifiedRecipientId)));
      if (!isRecipientOnline) {
        sendPushNotification(verifiedRecipientId, {
          ...message,
          senderName: data.senderName,
        });
      }
    } catch (error) {
      console.error('send-message error:', error);
      socket.emit('message-error', { tempId, error: 'Failed to send message' });
    }
  });

  socket.on('delete-message', (messageData) => {
    if (!socket.userId) return;

    try {
      const { recipientId } = messageData;
      if (!recipientId) return;

      io.to(String(recipientId)).emit('message-deleted', messageData);
    } catch (error) {
      console.error('delete-message error:', error);
    }
  });

  socket.on('typing', (data) => {
    if (!socket.userId) return;

    try {
      const { recipientId, isTyping } = data;
      if (!recipientId) return;

      io.to(String(recipientId)).emit('typing_status', {
        userId: socket.userId,
        isTyping,
      });
    } catch (error) {
      console.error('typing error:', error);
    }
  });

  socket.on('messages-read', async (data) => {
    if (!socket.userId) return;

    try {
      const { messageIds, chatid, senderId } = data;
      if (!messageIds?.length || !chatid || !senderId) return;

      const sanitizedIds = messageIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
      if (sanitizedIds.length === 0) return;

      // Persist read status and timestamp to DB
      const readTime = new Date();
      await ChatMessage.update(
        { isread: true, readat: readTime },
        {
          where: {
            messageid: { [Op.in]: sanitizedIds },
            isdeleted: false,
            senderid: { [Op.ne]: socket.userId },
          },
        }
      );

      // Notify the original sender that their messages were read
      io.to(String(senderId)).emit('messages-read-status', {
        messageIds: sanitizedIds,
        chatid: Number(chatid),
        readerId: socket.userId,
        readat: readTime.toISOString(),
      });
    } catch (error) {
      console.error('messages-read error:', error);
    }
  });
};

module.exports = {
  setupChatHandlers,
};
