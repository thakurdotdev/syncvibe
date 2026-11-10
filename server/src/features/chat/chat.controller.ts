import type { Request, Response } from 'express';
import { ChatError } from './chat.errors';
import { asObject, parseId } from './chat.validation';
import { listConversations, openDirectConversation } from './services/conversation.service';
import { listMessages, markRead, sendMessage } from './services/message.service';

type Handler = (req: Request, res: Response) => Promise<unknown>;

/** Runs a handler and turns a ChatError into its status and message; anything else is a 500. */
const respond =
  (handler: Handler) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json(await handler(req, res));
    } catch (error) {
      if (error instanceof ChatError) {
        res.status(error.status).json({ code: error.code, message: error.message });
        return;
      }
      console.error(`${req.method} ${req.path} failed:`, error);
      res.status(500).json({ code: 'INTERNAL', message: 'Something went wrong. Try again.' });
    }
  };

export const getConversations = respond(async (req) => ({
  conversations: await listConversations(req.user!.userid),
}));

export const openConversation = respond(async (req) => ({
  conversation: await openDirectConversation(
    req.user!.userid,
    parseId(asObject(req.body).userId, 'userId')
  ),
}));

export const getMessages = respond((req) =>
  listMessages(req.user!.userid, req.params.conversationId, req.query)
);

/**
 * Devices normally send over the socket. This is for when there isn't one: replying from a
 * notification while the app is closed.
 */
export const postMessage = respond(async (req) => ({
  message: await sendMessage(req.user!.userid, {
    ...asObject(req.body),
    conversationId: req.params.conversationId,
  }),
}));

/** Like `postMessage`, for "Mark as read" on a notification while the app is closed. */
export const postRead = respond(async (req) => ({
  receipt: await markRead(req.user!.userid, {
    ...asObject(req.body),
    conversationId: req.params.conversationId,
  }),
}));
