import type { Transaction } from 'sequelize';
import { Message, MessageReaction } from '@/models/index';
import type { MessageDto, ReactionDto } from '../chat.types';

/** How much of the original a reply shows above itself. */
const REPLY_PREVIEW_LENGTH = 140;

/** Turns messages into what devices receive, adding each one's reactions and the one it replies to. */
export const presentMessages = async (
  messages: Message[],
  transaction?: Transaction
): Promise<MessageDto[]> => {
  if (messages.length === 0) return [];

  const ids = messages.map((message) => message.id);
  const replyIds = [...new Set(messages.map((message) => message.replyToId).filter(Boolean))];

  const [reactionRows, replyTargets] = await Promise.all([
    MessageReaction.findAll({
      where: { messageId: ids },
      order: [['createdAt', 'ASC']],
      transaction,
    }),
    replyIds.length === 0
      ? Promise.resolve([] as Message[])
      : Message.findAll({
          where: { id: replyIds as number[] },
          attributes: ['id', 'senderId', 'type', 'body', 'attachment', 'deletedAt'],
          transaction,
        }),
  ]);

  const reactions = new Map<number, ReactionDto[]>();
  for (const row of reactionRows) {
    const list = reactions.get(row.messageId) ?? [];
    const entry = list.find((reaction) => reaction.emoji === row.emoji);
    if (entry) entry.userIds.push(row.userId);
    else list.push({ emoji: row.emoji, userIds: [row.userId] });
    reactions.set(row.messageId, list);
  }
  const replies = new Map(replyTargets.map((target) => [target.id, target]));

  return messages.map((message) => {
    const reply = message.replyToId ? replies.get(message.replyToId) : undefined;
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientId: message.clientId,
      type: message.type,
      body: message.body,
      attachment: message.attachment,
      call: message.type === 'call' ? message.meta : null,
      replyTo: reply
        ? {
            id: reply.id,
            senderId: reply.senderId,
            type: reply.type,
            body: reply.body?.slice(0, REPLY_PREVIEW_LENGTH) ?? null,
            hasAttachment: Boolean(reply.attachment),
            deleted: Boolean(reply.deletedAt),
          }
        : null,
      reactions: reactions.get(message.id) ?? [],
      editedAt: message.editedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  });
};
