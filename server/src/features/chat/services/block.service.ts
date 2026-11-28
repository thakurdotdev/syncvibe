import { Op, type Transaction } from 'sequelize';
import { ChatBlock, ConversationMember } from '@/models/index';
import { ChatError, invalid } from '../chat.errors';
import { emitToUsers } from '../chat.realtime';
import { parseId } from '../chat.validation';
import { requireMembers } from './conversation.service';

/**
 * Muting and blocking, per person. A muted conversation still delivers messages; it sends no
 * pushes, and the apps show nothing for it. A block stops messages both ways and calls to the one
 * who blocked; the blocked person isn't told, beyond being unable to send.
 */

const parseFlag = (value: unknown, name: string): boolean => {
  if (typeof value !== 'boolean') throw invalid(`${name} must be true or false`);
  return value;
};

/** The other person in a direct conversation. */
const peerIn = async (conversationId: number, userId: number): Promise<number> => {
  const members = await requireMembers(conversationId, userId);
  const peer = members.find((id) => id !== userId);
  if (peer == null) throw invalid('This conversation has no one else in it');
  return peer;
};

/** Who blocked whom between two people, if either did. */
export const blockBetween = async (
  a: number,
  b: number,
  transaction?: Transaction
): Promise<'mine' | 'theirs' | null> => {
  const rows = await ChatBlock.findAll({
    where: {
      [Op.or]: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    attributes: ['blockerId'],
    transaction,
  });
  if (rows.some((row) => row.blockerId === a)) return 'mine';
  return rows.length ? 'theirs' : null;
};

/** Throws if a message from `senderId` to `recipientId` isn't allowed. */
export const requireNotBlocked = async (senderId: number, recipientId: number): Promise<void> => {
  const block = await blockBetween(senderId, recipientId);
  if (block === 'mine') {
    throw new ChatError('BLOCKED', 'You blocked this person. Unblock them to send a message.');
  }
  if (block === 'theirs') throw new ChatError('BLOCKED', "You can't message this person");
};

export const setMuted = async (
  userId: number,
  conversationIdInput: unknown,
  mutedInput: unknown
): Promise<{ conversationId: number; muted: boolean }> => {
  const conversationId = parseId(conversationIdInput, 'conversationId');
  const muted = parseFlag(mutedInput, 'muted');
  await requireMembers(conversationId, userId);
  await ConversationMember.update({ muted }, { where: { conversationId, userId } });
  emitToUsers([userId], 'chat:settings', { conversationId, muted });
  return { conversationId, muted };
};

export const setBlocked = async (
  userId: number,
  conversationIdInput: unknown,
  blockedInput: unknown
): Promise<{ conversationId: number; blocked: boolean }> => {
  const conversationId = parseId(conversationIdInput, 'conversationId');
  const blocked = parseFlag(blockedInput, 'blocked');
  const peerId = await peerIn(conversationId, userId);
  if (blocked) {
    await ChatBlock.findOrCreate({
      where: { blockerId: userId, blockedId: peerId },
      defaults: { blockerId: userId, blockedId: peerId },
    });
  } else {
    await ChatBlock.destroy({ where: { blockerId: userId, blockedId: peerId } });
  }
  emitToUsers([userId], 'chat:settings', { conversationId, blocked });
  return { conversationId, blocked };
};

/** Whether `userId` muted the conversation: then a message in it sends no push. */
export const isMuted = async (conversationId: number, userId: number): Promise<boolean> => {
  const member = await ConversationMember.findOne({
    where: { conversationId, userId },
    attributes: ['muted'],
  });
  return Boolean(member?.muted);
};
