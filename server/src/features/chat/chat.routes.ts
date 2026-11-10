import { Router } from 'express';
import { authMiddleware } from '@/middleware/auth.middleware';
import { getConversations, getMessages, openConversation, postMessage } from './chat.controller';

/**
 * Reading over HTTP; sending, editing, deleting, reacting and read receipts go over the socket
 * (see socket/chat), which also carries everything that happens to other devices.
 */
export const chatRouter: Router = Router();

chatRouter.get('/chat/conversations', authMiddleware, getConversations);
chatRouter.post('/chat/conversations', authMiddleware, openConversation);
chatRouter.get('/chat/conversations/:conversationId/messages', authMiddleware, getMessages);
chatRouter.post('/chat/conversations/:conversationId/messages', authMiddleware, postMessage);
