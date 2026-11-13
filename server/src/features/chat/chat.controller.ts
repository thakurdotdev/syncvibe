import type { Request, Response } from 'express';
import { ChatError } from './chat.errors';
import { asObject, parseId } from './chat.validation';
import { cancelUpload, createUpload, getAttachment } from './services/attachment.service';
import { listConversations, openDirectConversation } from './services/conversation.service';
import { confirmDelivered, listMessages, markRead, sendMessage } from './services/message.service';

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
 * Devices normally send over the socket. This is for replying from a notification, which may have
 * no socket; replying there doesn't mark the conversation read.
 */
export const postMessage = respond(async (req) => ({
  message: await sendMessage(
    req.user!.userid,
    { ...asObject(req.body), conversationId: req.params.conversationId },
    { read: false }
  ),
}));

/** Like `postMessage`, for "Mark as read" on a notification while the app is closed. */
export const postRead = respond(async (req) => ({
  receipt: await markRead(req.user!.userid, {
    ...asObject(req.body),
    conversationId: req.params.conversationId,
  }),
}));

/** The app's background task got a message by push: the sender's tick turns into two. */
export const postDelivered = respond(async (req) => {
  await confirmDelivered(req.user!.userid, {
    ...asObject(req.body),
    conversationId: req.params.conversationId,
  });
  return { ok: true };
});

/** Somewhere to upload a file before sending it; the message then names it by its id. */
export const postAttachment = respond((req) =>
  createUpload(req.user!.userid, req.params.conversationId, asObject(req.body))
);

/** New links for a file, once the ones a device holds have run out. */
export const getAttachmentLinks = respond(async (req) => ({
  attachment: await getAttachment(req.user!.userid, req.params.attachmentId),
}));

/** A file removed before it was sent. */
export const deleteAttachment = respond(async (req) => {
  await cancelUpload(req.user!.userid, req.params.attachmentId);
  return { ok: true };
});
