import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { createChat, getChatList, deleteMessage, getAllMessages } from './chat.controller';

export const chatRouter: Router = Router();

// Chat Management
chatRouter.post('/create/chat', authMiddleware, createChat);
chatRouter.post('/chat/create', authMiddleware, createChat);
chatRouter.post('/chats', authMiddleware, createChat);

// Chat List
chatRouter.get('/get/chatlist', authMiddleware, getChatList);
chatRouter.get('/chat/list', authMiddleware, getChatList);
chatRouter.get('/chats', authMiddleware, getChatList);

// Message Delete
chatRouter.delete('/delete/message/:messageid', authMiddleware, deleteMessage);
chatRouter.delete('/message/:messageid', authMiddleware, deleteMessage);
chatRouter.put('/message/:messageid', authMiddleware, deleteMessage);

// Messages by Chat ID
chatRouter.get('/get/messages/:chatid', authMiddleware, getAllMessages);
chatRouter.get('/messages/:chatid', authMiddleware, getAllMessages);
