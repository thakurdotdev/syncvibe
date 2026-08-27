import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Chat, ChatMessage, User } from '@/models/index';

export const createChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiverid } = req.body as { receiverid?: number };
    const senderid = req.user!.userid;

    if (!receiverid) {
      res.status(400).json({ message: 'Receiverid is required' });
      return;
    }

    const participants = [senderid, receiverid].sort((a, b) => a - b);

    const existingChat = await Chat.findOne({
      where: { participants: { [Op.contains]: participants } },
    });

    if (existingChat) {
      res.status(200).json({ message: 'Chat already exists', chat: existingChat });
      return;
    }

    const newChat = await Chat.create({ participants, lastmessage: null });
    res.status(200).json({ message: 'Chat created successfully', chat: newChat });
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'An error occurred while creating a chat.' });
  }
};

export const getChatList = async (req: Request, res: Response): Promise<void> => {
  try {
    const userid = req.user!.userid;

    const chats = await Chat.findAll({
      where: { participants: { [Op.contains]: [userid] } },
      order: [['updatedat', 'DESC']],
    });

    const chatList = await Promise.all(
      chats.map(async (chat) => {
        const otherUserId = chat.participants.find((id) => id !== userid);

        const otherUser = otherUserId
          ? await User.findOne({
              where: { userid: otherUserId },
              attributes: ['name', 'profilepic', 'userid', 'username'],
            })
          : null;

        const unreadCount = await ChatMessage.count({
          where: {
            chatid: chat.chatid,
            isread: false,
            senderid: { [Op.ne]: userid },
            isdeleted: false,
          },
        });

        return {
          chatid: chat.chatid,
          otherUser,
          lastmessage: chat.lastmessage,
          updatedat: chat.updatedat,
          unreadCount,
        };
      })
    );

    res.status(200).json({ message: 'success', chatList });
  } catch (error) {
    console.error('Error in getChatList:', error);
    res.status(500).json({ error: 'An error occurred while fetching chats.' });
  }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const messageid = parseInt(String(req.params.messageid), 10);
    const { userid } = req.user!;

    const message = await ChatMessage.findOne({ where: { messageid } });

    if (!message) {
      res.status(404).json({ message: 'Message not found' });
      return;
    }

    if (message.senderid !== userid) {
      res.status(403).json({ message: 'You cannot delete this message' });
      return;
    }

    await ChatMessage.update({ isdeleted: true }, { where: { messageid } });
    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'An error occurred while deleting a message.' });
  }
};

export const getAllMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const chatid = parseInt(String(req.params.chatid), 10);

    if (!chatid) {
      res.status(400).json({ message: 'Chatid is required' });
      return;
    }

    const messages = await ChatMessage.findAll({
      where: { chatid, isdeleted: false },
      order: [['createdat', 'ASC']],
    });

    res.status(200).json({ message: 'success', chats: messages });
  } catch (error) {
    console.error('Error in getAllMessages:', error);
    res.status(500).json({ error: 'An error occurred while fetching messages.' });
  }
};
