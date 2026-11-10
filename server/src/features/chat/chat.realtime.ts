import { getIO } from '@/utils/socket-emitter';

/**
 * What the server sends to devices. Every event carries whole objects, so a device can apply one
 * without having seen the ones before it.
 *
 *   chat:message          { message }                  new message, to everyone in the conversation
 *   chat:message:updated  { message }                  edited, or its reactions changed
 *   chat:message:deleted  { conversationId, messageId, lastMessage }
 *   chat:receipt          ReceiptDto                   someone's read / delivered position moved
 *   chat:typing           { conversationId, userId, typing }
 *   presence:update       { userId, online }
 */

/**
 * Only sockets whose session was checked when they connected are in this room (see socket/auth).
 * Chat is never sent to the plain `<userid>` room, which older apps join by just naming a user.
 */
export const userRoom = (userId: number | string) => `user:${userId}`;

/** How long a device has to confirm a message before the recipient gets a push instead. */
const DELIVERY_ACK_MS = 6000;

export const emitToUsers = (userIds: number[], event: string, payload: unknown): void => {
  if (userIds.length === 0) return;
  getIO()?.to(userIds.map(userRoom)).emit(event, payload);
};

/** Sends to all of a user's devices and resolves to whether any of them confirmed it. */
export const emitWithConfirmation = (
  userId: number,
  event: string,
  payload: unknown
): Promise<boolean> =>
  new Promise((resolve) => {
    const io = getIO();
    if (!io || !io.sockets.adapter.rooms.get(userRoom(userId))?.size) {
      resolve(false);
      return;
    }
    io.to(userRoom(userId))
      .timeout(DELIVERY_ACK_MS)
      // On a timeout the error is set, and the confirmations that did arrive still come with it.
      .emit(event, payload, (_error: Error | null, confirmations?: unknown[]) => {
        resolve(Boolean(confirmations?.length));
      });
  });
