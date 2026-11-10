import type { Server } from 'socket.io';
import { Op } from 'sequelize';
import { emitToUsers, userRoom } from '@/features/chat/chat.realtime';
import { ConversationMember } from '@/models/index';
import { getIO } from '@/utils/socket-emitter';

/**
 * Who is online, from signed-in connections alone. Only the people someone has a conversation
 * with are told, never everyone.
 */

/** A dropped connection usually comes straight back; don't flicker to offline in between. */
const OFFLINE_AFTER_MS = 8000;

const online = new Set<number>();
const goingOffline = new Map<number, NodeJS.Timeout>();

export const isOnline = (userId: number): boolean => online.has(userId);

/** Whether any device of the user is connected, signed in or not. */
export const hasLiveConnection = (userId: number | string): boolean => {
  const rooms = getIO()?.sockets.adapter.rooms;
  return Boolean(rooms?.get(userRoom(userId))?.size || rooms?.get(String(userId))?.size);
};

/** Everyone `userId` has a conversation with: the people who may see whether they're online. */
const partnerIdsOf = async (userId: number): Promise<number[]> => {
  const mine = await ConversationMember.findAll({
    where: { userId },
    attributes: ['conversationId'],
  });
  if (mine.length === 0) return [];
  const partners = await ConversationMember.findAll({
    where: {
      conversationId: mine.map((membership) => membership.conversationId),
      userId: { [Op.ne]: userId },
    },
    attributes: ['userId'],
  });
  return [...new Set(partners.map((partner) => partner.userId))];
};

const announce = (userId: number, isOnlineNow: boolean) => {
  partnerIdsOf(userId)
    .then((partners) => emitToUsers(partners, 'presence:update', { userId, online: isOnlineNow }))
    .catch((error) => console.error('Announcing presence failed:', error));
};

export const presenceConnected = (userId: number): void => {
  const timer = goingOffline.get(userId);
  if (timer) clearTimeout(timer);
  goingOffline.delete(userId);

  if (online.has(userId)) return;
  online.add(userId);
  announce(userId, true);
};

export const presenceDisconnected = (io: Server, userId: number): void => {
  if (io.sockets.adapter.rooms.get(userRoom(userId))?.size) return;
  if (goingOffline.has(userId)) return;

  goingOffline.set(
    userId,
    setTimeout(() => {
      goingOffline.delete(userId);
      if (io.sockets.adapter.rooms.get(userRoom(userId))?.size) return;
      online.delete(userId);
      announce(userId, false);
    }, OFFLINE_AFTER_MS)
  );
};
