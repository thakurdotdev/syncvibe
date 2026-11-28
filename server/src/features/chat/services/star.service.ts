import { ChatStar, ConversationMember, Message } from '@/models/index';
import { invalid, notFound } from '../chat.errors';
import { emitToUsers } from '../chat.realtime';
import type { MessageDto } from '../chat.types';
import { parseId } from '../chat.validation';
import { requireMembers } from './conversation.service';
import { presentMessages } from './message.presenter';

/**
 * Starred messages: each person's own list of messages to find again. Starring tells only your
 * own devices (chat:starred). A message deleted for everyone leaves the list.
 */

const MAX_STARRED = 300;

/** Stars or unstars a message in one of your conversations. */
export const setStarred = async (
  userId: number,
  messageIdInput: unknown,
  starredInput: unknown
): Promise<{ conversationId: number; messageId: number; starred: boolean }> => {
  const messageId = parseId(messageIdInput, 'messageId');
  if (typeof starredInput !== 'boolean') throw invalid('starred must be true or false');
  const message = await Message.findOne({
    where: { id: messageId, deletedAt: null },
    attributes: ['id', 'conversationId', 'type'],
  });
  if (!message) throw notFound('Message');
  try {
    await requireMembers(message.conversationId, userId);
  } catch {
    throw notFound('Message');
  }
  if (message.type === 'call') throw invalid("Calls can't be starred");

  if (starredInput) {
    await ChatStar.findOrCreate({
      where: { userId, messageId },
      defaults: { userId, messageId },
    });
  } else {
    await ChatStar.destroy({ where: { userId, messageId } });
  }
  const change = { conversationId: message.conversationId, messageId, starred: starredInput };
  emitToUsers([userId], 'chat:starred', change);
  return change;
};

/** Your starred messages, the latest starred first, from conversations you're still in. */
export const listStarred = async (userId: number): Promise<{ messages: MessageDto[] }> => {
  const [stars, memberships] = await Promise.all([
    ChatStar.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: MAX_STARRED,
      attributes: ['messageId'],
    }),
    ConversationMember.findAll({ where: { userId }, attributes: ['conversationId'] }),
  ]);
  if (stars.length === 0) return { messages: [] };

  const mine = new Set(memberships.map((m) => m.conversationId));
  const rows = await Message.findAll({
    where: { id: stars.map((star) => star.messageId), deletedAt: null },
  });
  const byId = new Map(
    rows.filter((row) => mine.has(row.conversationId)).map((row) => [row.id, row])
  );
  const ordered = stars.map((star) => byId.get(star.messageId)).filter((row) => row != null);
  return { messages: await presentMessages(ordered) };
};
