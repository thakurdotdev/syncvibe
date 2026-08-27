import type { Server } from 'socket.io';
import { Op } from 'sequelize';
import type { AuthenticatedSocket, SocketContext } from './types';
import { ChatMessage, Chat } from '@/models/index';
import { sendPushNotification } from './notification';

interface SendMessageData {
  tempId?: string;
  chatid: number | string;
  content?: string;
  fileurl?: string;
  senderName?: string;
}

interface DeleteMessageData {
  recipientId?: string | number;
  messageid?: string | number;
}

interface TypingData {
  recipientId?: string | number;
  isTyping: boolean;
}

interface MessagesReadData {
  messageIds: Array<number | string>;
  chatid: number | string;
  senderId: string | number;
}

export const setupChatHandlers = (
  io: Server,
  socket: AuthenticatedSocket,
  context: SocketContext
): void => {
  const { userSockets, onlineUsers } = context;

  socket.on('join-chat', (room?: string | number) => {
    if (!room || !socket.userId) return;
    socket.join(String(room));
  });

  socket.on('send-message', async (data: SendMessageData) => {
    if (!socket.userId) return;

    const { tempId, chatid, content, fileurl } = data;
    if (!chatid || (!content && !fileurl)) {
      socket.emit('message-error', { tempId, error: 'Invalid message data' });
      return;
    }

    try {
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

      const verifiedRecipientId = chat.participants.find(
        (p: string | number) => Number(p) !== numericUserId
      );
      if (!verifiedRecipientId) {
        socket.emit('message-error', { tempId, error: 'Recipient not found in chat' });
        return;
      }

      const dbMessage = await ChatMessage.create({
        chatid: Number(chatid),
        senderid: numericUserId,
        content: content || null,
        fileurl: fileurl || null,
      });

      const lastMessageContent = content || 'Sent an attachment';
      await Chat.update(
        { lastmessage: lastMessageContent, updatedat: new Date() },
        { where: { chatid: Number(chatid) } }
      );

      const message = dbMessage.toJSON();

      socket.emit('message-ack', { tempId, message });

      const recipientKey = String(verifiedRecipientId);
      io.to(recipientKey).emit('message-received', {
        ...message,
        senderName: data.senderName,
        participants: chat.participants,
      });

      const recipientSocket =
        userSockets.get(recipientKey) || userSockets.get(String(Number(verifiedRecipientId)));
      const isRecipientOnline =
        recipientSocket &&
        (onlineUsers.has(recipientKey) || onlineUsers.has(String(Number(verifiedRecipientId))));
      if (!isRecipientOnline) {
        sendPushNotification(verifiedRecipientId, {
          ...message,
          senderName: data.senderName,
        }).catch(console.error);
      }
    } catch (error) {
      console.error('send-message error:', error);
      socket.emit('message-error', { tempId, error: 'Failed to send message' });
    }
  });

  socket.on('delete-message', (messageData: DeleteMessageData) => {
    if (!socket.userId) return;

    try {
      const { recipientId } = messageData;
      if (!recipientId) return;

      io.to(String(recipientId)).emit('message-deleted', messageData);
    } catch (error) {
      console.error('delete-message error:', error);
    }
  });

  socket.on('typing', (data: TypingData) => {
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

  socket.on('messages-read', async (data: MessagesReadData) => {
    if (!socket.userId) return;

    try {
      const { messageIds, chatid, senderId } = data;
      if (!messageIds?.length || !chatid || !senderId) return;

      const sanitizedIds = messageIds.map((id) => Number(id)).filter((id) => !isNaN(id) && id > 0);
      if (sanitizedIds.length === 0) return;

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
