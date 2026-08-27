import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Chat, ChatMessage, User } from '@/models/index';
import sequelize from '@/utils/sequelize';

export const createChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiverid } = req.body as { receiverid?: number };
    const senderid = req.user!.userid;

    if (!receiverid) {
      res.status(400).json({ message: 'Receiverid is required' });
      return;
    }

    if (receiverid === senderid) {
      res.status(400).json({ message: 'Cannot create chat with yourself' });
      return;
    }

    const receiver = await User.findByPk(receiverid);
    if (!receiver) {
      res.status(404).json({ message: 'User not found' });
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

    if (chats.length === 0) {
      res.status(200).json({ message: 'success', chatList: [] });
      return;
    }

    const chatMap = new Map<number, number>();
    const otherUserIds = new Set<number>();
    const chatIds: number[] = [];

    for (const chat of chats) {
      const otherId = chat.participants.find((id) => id !== userid);
      if (otherId) {
        chatMap.set(chat.chatid, otherId);
        otherUserIds.add(otherId);
        chatIds.push(chat.chatid);
      }
    }

    if (otherUserIds.size === 0) {
      res.status(200).json({ message: 'success', chatList: [] });
      return;
    }

    const [users, unreadCounts] = await Promise.all([
      User.findAll({
        where: { userid: { [Op.in]: Array.from(otherUserIds) } },
        attributes: ['name', 'profilepic', 'userid', 'username'],
      }),
      ChatMessage.findAll({
        attributes: ['chatid', [sequelize.fn('COUNT', sequelize.col('messageid')), 'unreadCount']],
        where: {
          chatid: { [Op.in]: chatIds },
          isread: false,
          senderid: { [Op.ne]: userid },
          isdeleted: false,
        },
        group: ['chatid'],
        raw: true,
      }),
    ]);

    const userMap = new Map<number, User>();
    for (const user of users) {
      userMap.set(user.userid, user);
    }

    const unreadMap = new Map<number, number>();
    for (const item of unreadCounts as unknown as Array<{
      chatid: number;
      unreadCount: string | number;
    }>) {
      unreadMap.set(item.chatid, Number(item.unreadCount));
    }

    const chatList = [];
    for (const chat of chats) {
      const otherUserId = chatMap.get(chat.chatid);
      if (!otherUserId) continue;

      const otherUser = userMap.get(otherUserId);
      if (!otherUser) continue;

      chatList.push({
        chatid: chat.chatid,
        otherUser,
        lastmessage: chat.lastmessage,
        updatedat: chat.updatedat,
        unreadCount: unreadMap.get(chat.chatid) ?? 0,
      });
    }

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

    if (!messageid || isNaN(messageid)) {
      res.status(400).json({ message: 'Message not found' });
      return;
    }

    const message = await ChatMessage.findOne({
      where: { messageid },
      attributes: ['messageid', 'senderid'],
    });

    if (!message) {
      res.status(404).json({ message: 'Message not found' });
      return;
    }

    if (message.senderid !== userid) {
      res.status(403).json({ message: 'You cannot delete this message' });
      return;
    }

    await message.update({ isdeleted: true });
    res.status(200).json({ message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'An error occurred while deleting a message.' });
  }
};

export const getAllMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const chatid = parseInt(String(req.params.chatid), 10);
    const userid = req.user!.userid;

    if (!chatid || isNaN(chatid)) {
      res.status(400).json({ message: 'Chatid is required' });
      return;
    }

    const chat = await Chat.findOne({
      where: {
        chatid,
        participants: { [Op.contains]: [userid] },
      },
      attributes: ['chatid'],
    });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
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
