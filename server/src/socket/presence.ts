import type { Server, Socket } from 'socket.io';
import { Op } from 'sequelize';
import { emitToUsers, userRoom } from '@/features/chat/chat.realtime';
import { ConversationMember } from '@/models/index';
import { getIO } from '@/utils/socket-emitter';

/**
 * Who is online, from signed-in connections alone. Only the people someone has a conversation
 * with are told, never everyone.
 */

/**
 * A connection that drops on its own (network change, lift, tunnel) usually comes straight back,
 * so the user stays online that long. Closing the app or putting it away says so at once.
 */
const RECONNECT_GRACE_MS = 3000;
/** Disconnect reasons that mean the user left, rather than the network dropping. */
const DELIBERATE = new Set(['client namespace disconnect', 'server namespace disconnect']);

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

/**
 * Online means the app is open on some device: a socket counts unless its app said it went to
 * the background. Apps before 1.7.2 never say, so their sockets count while connected.
 */
const hasActiveSocket = (io: Server, userId: number, except?: Socket): boolean => {
  for (const id of io.sockets.adapter.rooms.get(userRoom(userId)) ?? []) {
    const socket = io.sockets.sockets.get(id);
    if (socket && socket !== except && socket.data.active !== false) return true;
  }
  return false;
};

const cancelGoingOffline = (userId: number) => {
  const timer = goingOffline.get(userId);
  if (timer) clearTimeout(timer);
  goingOffline.delete(userId);
};

const goOffline = (io: Server, userId: number) => {
  cancelGoingOffline(userId);
  if (hasActiveSocket(io, userId) || !online.has(userId)) return;
  online.delete(userId);
  announce(userId, false);
};

export const presenceConnected = (userId: number): void => {
  cancelGoingOffline(userId);
  if (online.has(userId)) return;
  online.add(userId);
  announce(userId, true);
};

/** The app on this socket came to the front or went to the background. */
export const presenceActive = (io: Server, socket: Socket, userId: number, active: boolean) => {
  socket.data.active = active;
  if (active) presenceConnected(userId);
  else goOffline(io, userId);
};

export const presenceDisconnected = (
  io: Server,
  socket: Socket,
  userId: number,
  reason: string
): void => {
  if (hasActiveSocket(io, userId, socket)) return;
  if (DELIBERATE.has(reason) || socket.data.active === false) {
    goOffline(io, userId);
    return;
  }
  if (goingOffline.has(userId)) return;
  goingOffline.set(
    userId,
    setTimeout(() => goOffline(io, userId), RECONNECT_GRACE_MS)
  );
};
