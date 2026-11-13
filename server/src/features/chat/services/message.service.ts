import { randomUUID } from 'node:crypto';
import { v2 as Cloudinary } from 'cloudinary';
import { Op, QueryTypes, type Transaction } from 'sequelize';
import sequelize from '@/utils/sequelize';
import { Conversation, ConversationMember, Message, MessageReaction, User } from '@/models/index';
import { createRateLimiter } from '@/utils/rate-limiter';
import { clearMessageNotification, sendPushNotification } from '@/socket/notification';
import { ChatError, invalid, notFound } from '../chat.errors';
import { emitToUsers, emitWithConfirmation } from '../chat.realtime';
import type { CallDto, MessageDto, ReceiptDto } from '../chat.types';
import {
  parseAttachment,
  parseBody,
  parseClientId,
  parseEmoji,
  parseId,
  parseOptionalId,
  parsePageSize,
} from '../chat.validation';
import { isStoredFile, type MessageAttachment } from '@/models/chat/message.model';
import { claimAttachment, prepareAttachment, removeAttachmentOf } from './attachment.service';
import { findDirectConversationId, requireMembers } from './conversation.service';
import { attachmentLabel, presentMessages } from './message.presenter';

// Per person, across all their devices. Far above what typing by hand reaches.
const allowSend = createRateLimiter({ limit: 30, windowMs: 10_000 });
const allowChange = createRateLimiter({ limit: 60, windowMs: 10_000 });

const limit = (allowed: boolean) => {
  if (!allowed) throw new ChatError('RATE_LIMITED', "You're doing that too fast. Wait a moment.");
};

const others = (members: number[], userId: number) => members.filter((id) => id !== userId);

// ── Sending ─────────────────────────────────────────────────────────────────

const pushPreview = (message: MessageDto) =>
  message.body || attachmentLabel(message.attachment) || 'New message';

/** A photo shows in the notification itself; the link lasts long enough for that. */
const pushImage = (message: MessageDto) =>
  message.attachment?.kind === 'image' ? message.attachment.url : null;

/**
 * Sends a new message to everyone's devices. If none of the recipient's devices confirms it, they
 * get a push notification; if one does, the message counts as delivered.
 */
const announceMessage = (message: MessageDto, members: number[]): void => {
  emitToUsers([message.senderId], 'chat:message', { message });

  for (const recipientId of others(members, message.senderId)) {
    void (async () => {
      const confirmed = await emitWithConfirmation(recipientId, 'chat:message', { message });
      if (confirmed) {
        await markDelivered(recipientId, message.conversationId, message.id);
        return;
      }
      if (message.type === 'call') return;
      const sender = await User.findByPk(message.senderId, { attributes: ['name'] });
      await sendPushNotification(recipientId, {
        senderName: sender?.name,
        content: pushPreview(message),
        conversationId: message.conversationId,
        messageId: message.id,
        sentAt: message.createdAt,
        senderid: message.senderId,
        imageUrl: pushImage(message),
      });
    })().catch((error) => console.error('Announcing a chat message failed:', error));
  }
};

interface NewMessage {
  conversationId: number;
  senderId: number;
  clientId: string;
  type: MessageDto['type'];
  body: string | null;
  attachment: MessageAttachment | null;
  meta: CallDto | null;
  replyToId: number | null;
}

/**
 * Stores a message once. A device that didn't hear back sends the same clientId again and gets
 * the message it already stored, instead of a second copy: (sender, clientId) is unique.
 */
const storeMessage = async (
  input: NewMessage,
  transaction: Transaction,
  read: boolean
): Promise<{ message: Message; created: boolean; receipt: ReceiptDto | null }> => {
  const [message, created] = await Message.findOrCreate({
    where: { senderId: input.senderId, clientId: input.clientId },
    defaults: input,
    transaction,
  });

  if (!created) {
    if (message.conversationId !== input.conversationId || message.deletedAt) {
      throw invalid('This message was already sent');
    }
    return { message, created, receipt: null };
  }

  if (isStoredFile(input.attachment)) {
    await claimAttachment(input.attachment.id, message.id, transaction);
  }

  await Conversation.update(
    { lastMessageAt: message.createdAt },
    {
      where: {
        id: input.conversationId,
        [Op.or]: [{ lastMessageAt: null }, { lastMessageAt: { [Op.lt]: message.createdAt } }],
      },
      transaction,
    }
  );
  // Sending from the conversation means you have seen everything above it. A reply from a
  // notification only shows those messages reached you: they stay unread until marked read.
  const now = new Date();
  const [, moved] = await ConversationMember.update(
    read
      ? {
          lastReadMessageId: message.id,
          lastReadAt: now,
          lastDeliveredMessageId: message.id,
          lastDeliveredAt: now,
        }
      : { lastDeliveredMessageId: message.id, lastDeliveredAt: now },
    {
      where: {
        conversationId: input.conversationId,
        userId: input.senderId,
        [read ? 'lastReadMessageId' : 'lastDeliveredMessageId']: { [Op.lt]: message.id },
      },
      transaction,
      returning: true,
    }
  );
  return { message, created, receipt: moved[0] ? toReceipt(moved[0]) : null };
};

export interface SendOptions {
  /** False for a reply from a notification, which doesn't mean the conversation was read. */
  read?: boolean;
}

export const sendMessage = async (
  senderId: number,
  input: Record<string, unknown>,
  { read = true }: SendOptions = {}
): Promise<MessageDto> => {
  const conversationId = parseId(input.conversationId, 'conversationId');
  const clientId = parseClientId(input.clientId);
  const body = parseBody(input.body);
  const replyToId = parseOptionalId(input.replyToId, 'replyToId');
  // A file uploaded to the chat bucket; or, from app versions before that, a Cloudinary photo.
  const hasFile = input.attachmentId != null;
  const legacyPhoto = hasFile ? null : parseAttachment(input.attachment);
  if (!body && !hasFile && !legacyPhoto) throw invalid('A message needs text or a file');

  const members = await requireMembers(conversationId, senderId);
  limit(allowSend(senderId));
  const attachment: MessageAttachment | null = hasFile
    ? await prepareAttachment(senderId, conversationId, input.attachmentId)
    : legacyPhoto;
  const type = !attachment
    ? 'text'
    : isStoredFile(attachment) && attachment.kind !== 'image'
      ? 'file'
      : 'image';

  const { message, created, receipt } = await sequelize.transaction(async (transaction) => {
    if (replyToId) {
      const target = await Message.findOne({
        where: { id: replyToId, conversationId, deletedAt: null },
        attributes: ['id'],
        transaction,
      });
      if (!target) throw invalid('The message you replied to is no longer there');
    }

    const stored = await storeMessage(
      {
        conversationId,
        senderId,
        clientId,
        type,
        body,
        attachment,
        meta: null,
        replyToId,
      },
      transaction,
      read
    );
    const [presented] = await presentMessages([stored.message], transaction);
    return { message: presented!, created: stored.created, receipt: stored.receipt };
  });

  if (created) {
    announceMessage(message, members);
    // After the message, so devices already have it when its sender's position moves.
    if (receipt) emitToUsers(members, 'chat:receipt', receipt);
  }
  return message;
};

/**
 * Adds a call to the conversation two people already have, as a message both of them see. Calls
 * start from a conversation, so there is one; a call can't create it.
 */
export const recordCall = async (
  callerId: number,
  receiverId: number,
  call: CallDto
): Promise<void> => {
  if (!Number.isSafeInteger(callerId) || !Number.isSafeInteger(receiverId)) return;
  const conversationId = await findDirectConversationId(callerId, receiverId);
  if (!conversationId) return;

  const { message, receipt } = await sequelize.transaction(async (transaction) => {
    const stored = await storeMessage(
      {
        conversationId,
        senderId: callerId,
        clientId: `call-${randomUUID()}`,
        type: 'call',
        body: null,
        attachment: null,
        meta: call,
        replyToId: null,
      },
      transaction,
      true
    );
    return {
      message: (await presentMessages([stored.message], transaction))[0]!,
      receipt: stored.receipt,
    };
  });

  const members = await requireMembers(conversationId, callerId);
  announceMessage(message, members);
  if (receipt) emitToUsers(members, 'chat:receipt', receipt);
};

// ── Reading history ─────────────────────────────────────────────────────────

/** A page of messages, oldest first. Without `before` it is the latest page. */
export const listMessages = async (
  userId: number,
  conversationIdInput: unknown,
  query: { before?: unknown; limit?: unknown }
): Promise<{ messages: MessageDto[]; hasMore: boolean }> => {
  const conversationId = parseId(conversationIdInput, 'conversationId');
  const before = parseOptionalId(query.before, 'before');
  const pageSize = parsePageSize(query.limit);
  await requireMembers(conversationId, userId);

  const found = await Message.findAll({
    where: {
      conversationId,
      deletedAt: null,
      ...(before ? { id: { [Op.lt]: before } } : {}),
    },
    order: [['id', 'DESC']],
    // One extra tells whether there is anything older.
    limit: pageSize + 1,
  });

  const hasMore = found.length > pageSize;
  const messages = await presentMessages(found.slice(0, pageSize).reverse());
  return { messages, hasMore };
};

// ── Changing a message ──────────────────────────────────────────────────────

/** The message with its conversation's members, as long as `userId` is one of them. */
const loadForMember = async (messageId: number, userId: number) => {
  const message = await Message.findOne({ where: { id: messageId, deletedAt: null } });
  if (!message) throw notFound('Message');
  try {
    return { message, members: await requireMembers(message.conversationId, userId) };
  } catch {
    throw notFound('Message');
  }
};

const present = async (message: Message): Promise<MessageDto> =>
  (await presentMessages([message]))[0]!;

export const editMessage = async (
  userId: number,
  input: Record<string, unknown>
): Promise<MessageDto> => {
  const messageId = parseId(input.messageId, 'messageId');
  const body = parseBody(input.body);
  limit(allowChange(userId));

  const { message, members } = await loadForMember(messageId, userId);
  if (message.senderId !== userId || message.type === 'call') {
    throw new ChatError('FORBIDDEN', "You can't edit this message");
  }
  // A file can lose its caption; a text message can't become empty.
  if (!body && !message.attachment) throw invalid("A message can't be empty");
  if (body === message.body) return present(message);

  await message.update({ body, editedAt: new Date() });

  const updated = await present(message);
  emitToUsers(members, 'chat:message:updated', { message: updated });
  return updated;
};

/** `chat/chat_6_1793889690_ab12` from the address Cloudinary gave the upload. */
const cloudinaryPublicId = (url: string): string | null =>
  /\/(chat\/chat_[A-Za-z0-9_]+)\.[a-z0-9]+$/i.exec(url)?.[1] ?? null;

/**
 * Deletes for everyone. The row stays so replies to it can say it's gone, but the text and the
 * photo don't: the content is removed here and the file from storage.
 */
export const deleteMessage = async (
  userId: number,
  input: Record<string, unknown>
): Promise<{ conversationId: number; messageId: number }> => {
  const messageId = parseId(input.messageId, 'messageId');
  limit(allowChange(userId));

  const { message, members } = await loadForMember(messageId, userId);
  if (message.senderId !== userId || message.type === 'call') {
    throw new ChatError('FORBIDDEN', "You can't delete this message");
  }
  const { conversationId, attachment } = message;

  const lastMessage = await sequelize.transaction(async (transaction) => {
    await message.update(
      { deletedAt: new Date(), body: null, attachment: null, meta: null },
      { transaction }
    );
    await MessageReaction.destroy({ where: { messageId }, transaction });
    const latest = await Message.findOne({
      where: { conversationId, deletedAt: null },
      order: [['id', 'DESC']],
      transaction,
    });
    return latest ? (await presentMessages([latest], transaction))[0]! : null;
  });

  if (isStoredFile(attachment)) {
    removeAttachmentOf(messageId).catch((error: unknown) =>
      console.error('Removing a deleted chat file failed:', error)
    );
  }
  const publicId =
    attachment && !isStoredFile(attachment) ? cloudinaryPublicId(attachment.url) : null;
  if (publicId) {
    Cloudinary.uploader
      .destroy(publicId, { invalidate: true })
      .catch((error: unknown) => console.error('Removing a deleted chat photo failed:', error));
  }

  // The new last message lets conversation lists fix their preview without asking again.
  emitToUsers(members, 'chat:message:deleted', { conversationId, messageId, lastMessage });
  return { conversationId, messageId };
};

/** Sets, replaces or (with no emoji) removes the user's reaction to a message. */
export const setReaction = async (
  userId: number,
  input: Record<string, unknown>
): Promise<MessageDto> => {
  const messageId = parseId(input.messageId, 'messageId');
  const emoji = parseEmoji(input.emoji);
  limit(allowChange(userId));

  const { message, members } = await loadForMember(messageId, userId);
  if (message.type === 'call') throw new ChatError('FORBIDDEN', "You can't react to a call");

  if (emoji) {
    await MessageReaction.upsert({ messageId, userId, emoji, createdAt: new Date() });
  } else {
    await MessageReaction.destroy({ where: { messageId, userId } });
  }

  const updated = await present(message);
  emitToUsers(members, 'chat:message:updated', { message: updated });
  return updated;
};

// ── Read and delivered positions ────────────────────────────────────────────

const toReceipt = (member: ConversationMember): ReceiptDto => ({
  conversationId: member.conversationId,
  userId: member.userId,
  lastReadMessageId: member.lastReadMessageId,
  lastReadAt: member.lastReadAt?.toISOString() ?? null,
  lastDeliveredMessageId: member.lastDeliveredMessageId,
});

/**
 * To the other person, who sees their ticks change, and to the reader's own devices, which clear
 * the unread badge.
 */
const announceReceipt = async (receipt: ReceiptDto): Promise<ReceiptDto> => {
  emitToUsers(
    await requireMembers(receipt.conversationId, receipt.userId),
    'chat:receipt',
    receipt
  );
  return receipt;
};

/**
 * Moves the user's read position forward to `messageId`. It never moves back, and never past the
 * conversation's last message, whatever id the device sends.
 */
export const markRead = async (
  userId: number,
  input: Record<string, unknown>
): Promise<ReceiptDto | null> => {
  const conversationId = parseId(input.conversationId, 'conversationId');
  const messageId = parseId(input.messageId, 'messageId');
  await requireMembers(conversationId, userId);
  limit(allowChange(userId));

  const lastId = Number(await Message.max('id', { where: { conversationId } })) || 0;
  const target = Math.min(messageId, lastId);
  const now = new Date();

  // The "less than" in the WHERE is what keeps it moving forward only, even when two devices
  // report at once.
  const [moved] = await ConversationMember.update(
    { lastReadMessageId: target, lastReadAt: now },
    { where: { conversationId, userId, lastReadMessageId: { [Op.lt]: target } } }
  );
  if (!moved) return null;

  // What has been read has also been delivered.
  await ConversationMember.update(
    { lastDeliveredMessageId: target, lastDeliveredAt: now },
    { where: { conversationId, userId, lastDeliveredMessageId: { [Op.lt]: target } } }
  );

  // Read here, so the notification on their phone has nothing left to say.
  clearMessageNotification(userId, conversationId).catch(() => {});

  const member = await ConversationMember.findOne({ where: { conversationId, userId } });
  return member ? announceReceipt(toReceipt(member)) : null;
};

/** One of the user's devices has confirmed it received this message. */
export const markDelivered = async (
  userId: number,
  conversationId: number,
  messageId: number
): Promise<void> => {
  const [moved] = await ConversationMember.update(
    { lastDeliveredMessageId: messageId, lastDeliveredAt: new Date() },
    { where: { conversationId, userId, lastDeliveredMessageId: { [Op.lt]: messageId } } }
  );
  if (!moved) return;
  const member = await ConversationMember.findOne({ where: { conversationId, userId } });
  if (member) await announceReceipt(toReceipt(member));
};

/**
 * A device got a message by push, with no socket to confirm it on: the app's background task
 * says so here. Never past the conversation's last message from someone else.
 */
export const confirmDelivered = async (
  userId: number,
  input: Record<string, unknown>
): Promise<void> => {
  const conversationId = parseId(input.conversationId, 'conversationId');
  const messageId = parseId(input.messageId, 'messageId');
  await requireMembers(conversationId, userId);
  limit(allowChange(userId));

  const lastFromOthers =
    Number(await Message.max('id', { where: { conversationId, senderId: { [Op.ne]: userId } } })) ||
    0;
  const target = Math.min(messageId, lastFromOthers);
  if (target > 0) await markDelivered(userId, conversationId, target);
};

interface DeliveredRow {
  conversation_id: string;
  last_read_message_id: string;
  last_read_at: Date | null;
  last_delivered_message_id: string;
}

/**
 * A device has come online and is about to load its conversations, so everything sent while the
 * user was away has now reached them. One statement for all their conversations, which a model
 * update can't do: each row moves to a different message.
 */
export const markAllDelivered = async (userId: number): Promise<void> => {
  const rows = await sequelize.query<DeliveredRow>(
    `UPDATE chat_members me
     SET last_delivered_message_id = latest.id, last_delivered_at = NOW()
     FROM (
       SELECT m.conversation_id, MAX(m.id) AS id
       FROM chat_messages m
       JOIN chat_members mine ON mine.conversation_id = m.conversation_id
       WHERE mine.user_id = :userId AND m.sender_id <> :userId
       GROUP BY m.conversation_id
     ) latest
     WHERE me.user_id = :userId AND me.conversation_id = latest.conversation_id
       AND me.last_delivered_message_id < latest.id
     RETURNING me.conversation_id, me.last_read_message_id, me.last_read_at,
               me.last_delivered_message_id`,
    { replacements: { userId }, type: QueryTypes.SELECT }
  );
  await Promise.all(
    rows.map((row) =>
      announceReceipt({
        conversationId: Number(row.conversation_id),
        userId,
        lastReadMessageId: Number(row.last_read_message_id),
        lastReadAt: row.last_read_at?.toISOString() ?? null,
        lastDeliveredMessageId: Number(row.last_delivered_message_id),
      })
    )
  );
};

/** "Typing…" for the other person. Nothing is stored. */
const allowTyping = createRateLimiter({ limit: 20, windowMs: 10_000 });

export const announceTyping = async (
  userId: number,
  input: Record<string, unknown>
): Promise<void> => {
  const conversationId = parseId(input.conversationId, 'conversationId');
  if (!allowTyping(userId)) return;
  const members = await requireMembers(conversationId, userId);
  emitToUsers(others(members, userId), 'chat:typing', {
    conversationId,
    userId,
    typing: input.typing === true,
  });
};
