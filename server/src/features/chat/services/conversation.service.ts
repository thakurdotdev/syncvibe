import { QueryTypes, type Transaction } from 'sequelize';
import sequelize from '@/utils/sequelize';
import { ChatAttachment, Conversation, ConversationMember, Message, User } from '@/models/index';
import { isOnline } from '@/socket/presence';
import { invalid, notFound } from '../chat.errors';
import type { ConversationDto } from '../chat.types';
import { removeObject } from './attachment.storage';
import { presentMessages } from './message.presenter';

const MAX_CONVERSATIONS = 200;

const directKey = (a: number, b: number) => `${Math.min(a, b)}:${Math.max(a, b)}`;

// Who is in a direct conversation never changes, and every command asks. Kept small: when it
// fills up it starts again, which only costs a query each.
const memberCache = new Map<number, number[]>();
const MEMBER_CACHE_SIZE = 5000;

/** The members of a conversation, or a "not found" error if `userId` isn't one of them. */
export const requireMembers = async (conversationId: number, userId: number): Promise<number[]> => {
  let members = memberCache.get(conversationId);
  if (!members) {
    const rows = await ConversationMember.findAll({
      where: { conversationId },
      attributes: ['userId'],
    });
    members = rows.map((row) => row.userId);
    if (members.length > 0) {
      if (memberCache.size >= MEMBER_CACHE_SIZE) memberCache.clear();
      memberCache.set(conversationId, members);
    }
  }
  if (!members.includes(userId)) throw notFound();
  return members;
};

interface ConversationRow {
  id: string;
  created_at: Date;
  last_message_at: Date | null;
  my_last_read: string;
  peer_id: number;
  peer_last_read: string;
  peer_last_read_at: Date | null;
  peer_last_delivered: string;
  peer_name: string;
  peer_username: string;
  peer_profilepic: string | null;
  unread_count: string;
  latest_id: string | null;
}

/**
 * One row per conversation with the other person, both read positions, the unread count and the
 * id of the latest message. Written as SQL because a model query can't pick "the latest message
 * of each conversation" and count per row in one statement; the alternative is a query per
 * conversation.
 */
const conversationQuery = (filter: string) => `
  SELECT c.id,
         c.created_at,
         c.last_message_at,
         me.last_read_message_id AS my_last_read,
         peer.user_id AS peer_id,
         peer.last_read_message_id AS peer_last_read,
         peer.last_read_at AS peer_last_read_at,
         peer.last_delivered_message_id AS peer_last_delivered,
         u.name AS peer_name,
         u.username AS peer_username,
         u.profilepic AS peer_profilepic,
         (SELECT COUNT(*) FROM chat_messages unread
          WHERE unread.conversation_id = c.id
            AND unread.id > me.last_read_message_id
            AND unread.sender_id <> me.user_id
            AND unread.deleted_at IS NULL) AS unread_count,
         (SELECT MAX(latest.id) FROM chat_messages latest
          WHERE latest.conversation_id = c.id AND latest.deleted_at IS NULL) AS latest_id
  FROM chat_members me
  JOIN chat_conversations c ON c.id = me.conversation_id
  JOIN chat_members peer ON peer.conversation_id = c.id AND peer.user_id <> me.user_id
  JOIN users u ON u.userid = peer.user_id
  WHERE me.user_id = :userId AND ${filter}
  ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
  LIMIT ${MAX_CONVERSATIONS}`;

const toConversations = async (rows: ConversationRow[]): Promise<ConversationDto[]> => {
  const latestIds = rows.map((row) => row.latest_id).filter(Boolean) as string[];
  const latest = await presentMessages(
    latestIds.length ? await Message.findAll({ where: { id: latestIds } }) : []
  );
  const latestById = new Map(latest.map((message) => [message.id, message]));

  return rows.map((row) => ({
    id: Number(row.id),
    peer: {
      userid: row.peer_id,
      name: row.peer_name,
      username: row.peer_username,
      profilepic: row.peer_profilepic,
      online: isOnline(row.peer_id),
    },
    lastMessage: row.latest_id ? (latestById.get(Number(row.latest_id)) ?? null) : null,
    lastMessageAt: row.last_message_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    unreadCount: Number(row.unread_count),
    myLastReadMessageId: Number(row.my_last_read),
    peerLastReadMessageId: Number(row.peer_last_read),
    peerLastReadAt: row.peer_last_read_at?.toISOString() ?? null,
    peerLastDeliveredMessageId: Number(row.peer_last_delivered),
  }));
};

/**
 * Conversations with something in them, most recent first. One you have only opened stays out of
 * the other person's list until a message is sent.
 */
export const listConversations = async (userId: number): Promise<ConversationDto[]> => {
  const rows = await sequelize.query<ConversationRow>(
    conversationQuery(
      'EXISTS (SELECT 1 FROM chat_messages m WHERE m.conversation_id = c.id AND m.deleted_at IS NULL)'
    ),
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  return toConversations(rows);
};

export const getConversation = async (
  userId: number,
  conversationId: number
): Promise<ConversationDto> => {
  const rows = await sequelize.query<ConversationRow>(conversationQuery('c.id = :conversationId'), {
    replacements: { userId, conversationId },
    type: QueryTypes.SELECT,
  });
  const [conversation] = await toConversations(rows);
  if (!conversation) throw notFound();
  return conversation;
};

/** The conversation two people already have, if any. */
export const findDirectConversationId = async (a: number, b: number): Promise<number | null> => {
  const conversation = await Conversation.findOne({
    where: { directKey: directKey(a, b) },
    attributes: ['id'],
  });
  return conversation?.id ?? null;
};

export const openDirectConversation = async (
  userId: number,
  otherUserId: number
): Promise<ConversationDto> => {
  if (otherUserId === userId) throw invalid("You can't message yourself");

  const other = await User.findOne({
    where: { userid: otherUserId, isDeleted: false },
    attributes: ['userid'],
  });
  if (!other) throw notFound('User');

  const conversationId = await sequelize.transaction(async (transaction) => {
    // The unique key settles it when both people open the conversation at the same moment.
    const [conversation] = await Conversation.findOrCreate({
      where: { directKey: directKey(userId, otherUserId) },
      defaults: { directKey: directKey(userId, otherUserId) },
      transaction,
    });
    await ConversationMember.bulkCreate(
      [
        { conversationId: conversation.id, userId },
        { conversationId: conversation.id, userId: otherUserId },
      ],
      { ignoreDuplicates: true, transaction }
    );
    return conversation.id;
  });
  return getConversation(userId, conversationId);
};

/** For account deletion: the user's conversations go with them, messages and all. */
export const deleteConversationsOf = async (
  userId: number,
  transaction: Transaction
): Promise<void> => {
  const memberships = await ConversationMember.findAll({
    where: { userId },
    attributes: ['conversationId'],
    transaction,
  });
  if (memberships.length === 0) return;
  const ids = memberships.map((membership) => membership.conversationId);
  const files = await ChatAttachment.findAll({
    where: { conversationId: ids, status: ['pending', 'sent'] },
    attributes: ['storageKey'],
    transaction,
  });
  // Members, messages, reactions and file rows follow through the tables' ON DELETE CASCADE.
  await Conversation.destroy({ where: { id: ids }, transaction });
  memberCache.clear();

  // The files themselves go once the deletion is certain.
  if (files.length > 0) {
    transaction.afterCommit(() => {
      for (const file of files) {
        removeObject(file.storageKey).catch((error: unknown) =>
          console.error('Removing a chat file of a deleted account failed:', error)
        );
      }
    });
  }
};
