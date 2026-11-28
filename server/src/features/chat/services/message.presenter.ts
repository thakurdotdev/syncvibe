import type { Transaction } from 'sequelize';
import { Message, MessageReaction, Song } from '@/models/index';
import {
  isStoredFile,
  type CallMeta,
  type MessageAttachment,
  type ContentMeta,
  type StoredFile,
} from '@/models/chat/message.model';
import {
  FILE_RULES,
  contentDisposition,
  extensionOf,
  isVoiceMessageName,
  servedType,
} from '../attachment.rules';
import type { AttachmentDto, FileAttachmentDto, MessageDto, ReactionDto } from '../chat.types';
import { attachmentsEnabled, signRead } from './attachment.storage';

/** How much of the original a reply shows above itself. */
const REPLY_PREVIEW_LENGTH = 140;

/** A file with links to read it, for the members of its conversation. Signing needs no request. */
export const presentFile = async (file: StoredFile): Promise<FileAttachmentDto> => {
  const { key, ...visible } = file;
  const rule = FILE_RULES[extensionOf(file.name)];
  if (!attachmentsEnabled() || !rule) {
    return { ...visible, url: null, downloadUrl: null, expiresAt: null };
  }
  const download = await signRead(key, {
    contentType: rule.mime,
    disposition: contentDisposition('attachment', file.name),
  });
  const view = rule.viewable
    ? await signRead(key, {
        contentType: servedType(rule),
        disposition: contentDisposition('inline', file.name),
      })
    : download;
  return { ...visible, url: view.url, downloadUrl: download.url, expiresAt: view.expiresAt };
};

const presentAttachment = async (
  attachment: MessageAttachment | null
): Promise<AttachmentDto | null> => {
  if (!attachment) return null;
  if (isStoredFile(attachment)) return presentFile(attachment);
  return { kind: 'image', ...attachment };
};

/** "Photo", "Video", "Audio" or the file's name: for previews and notifications. */
export const attachmentLabel = (attachment: MessageAttachment | AttachmentDto | null): string => {
  if (!attachment) return '';
  const kind = 'kind' in attachment ? attachment.kind : 'image';
  if (kind === 'image') return 'Photo';
  if (kind === 'video') return 'Video';
  if (kind === 'audio') {
    return 'name' in attachment && isVoiceMessageName(attachment.name) ? 'Voice message' : 'Audio';
  }
  return 'name' in attachment && attachment.name ? attachment.name : 'File';
};

/** Turns messages into what devices receive, adding each one's reactions and the one it replies to. */
export const presentMessages = async (
  messages: Message[],
  transaction?: Transaction
): Promise<MessageDto[]> => {
  if (messages.length === 0) return [];

  const ids = messages.map((message) => message.id);
  const replyIds = [...new Set(messages.map((message) => message.replyToId).filter(Boolean))];
  const songIds = [
    ...new Set(
      messages
        .map((message) => (message.type === 'song' ? (message.meta as ContentMeta)?.songId : null))
        .filter((songId): songId is string => Boolean(songId))
    ),
  ];

  const [reactionRows, replyTargets, songRows] = await Promise.all([
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
    songIds.length === 0
      ? Promise.resolve([] as Song[])
      : Song.findAll({
          where: { songId: songIds },
          attributes: ['songId', 'songData'],
          transaction,
        }),
  ]);
  const songs = new Map(songRows.map((row) => [row.songId, row.songData]));

  const reactions = new Map<number, ReactionDto[]>();
  for (const row of reactionRows) {
    const list = reactions.get(row.messageId) ?? [];
    const entry = list.find((reaction) => reaction.emoji === row.emoji);
    if (entry) entry.userIds.push(row.userId);
    else list.push({ emoji: row.emoji, userIds: [row.userId] });
    reactions.set(row.messageId, list);
  }
  const replies = new Map(replyTargets.map((target) => [target.id, target]));
  const attachments = await Promise.all(
    messages.map((message) => presentAttachment(message.attachment))
  );

  return messages.map((message, index) => {
    const reply = message.replyToId ? replies.get(message.replyToId) : undefined;
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientId: message.clientId,
      type: message.type,
      body: message.body,
      attachment: attachments[index] ?? null,
      call: message.type === 'call' ? (message.meta as CallMeta | null) : null,
      song:
        message.type === 'song'
          ? (songs.get((message.meta as ContentMeta | null)?.songId ?? '') ?? null)
          : null,
      forwarded:
        message.type !== 'call' && Boolean((message.meta as ContentMeta | null)?.forwarded),
      link: message.type === 'text' ? ((message.meta as ContentMeta | null)?.link ?? null) : null,
      replyTo: reply
        ? {
            id: reply.id,
            senderId: reply.senderId,
            type: reply.type,
            body: reply.body?.slice(0, REPLY_PREVIEW_LENGTH) ?? null,
            hasAttachment: Boolean(reply.attachment),
            attachmentKind: reply.attachment
              ? isStoredFile(reply.attachment)
                ? reply.attachment.kind
                : 'image'
              : null,
            attachmentName: isStoredFile(reply.attachment) ? reply.attachment.name : null,
            deleted: Boolean(reply.deletedAt),
          }
        : null,
      reactions: reactions.get(message.id) ?? [],
      editedAt: message.editedAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  });
};
