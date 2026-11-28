import type { Server, Socket } from 'socket.io';
import { appendMessage, getHistory, toggleReaction } from './chat-history';
import { findMember, generateMessageId, isMuted, musicGroups, type MusicGroup } from './state';
import { createRateLimiter } from '@/utils/rate-limiter';

/**
 * Real-time room chat: messages, replies, message reactions, song reactions and typing.
 *
 * Compatibility: web and mobile clients share these events, so every change here is
 * additive. Existing event names and payload fields keep their meaning; new fields
 * (`replyTo`, `reactions`) and new events (`message-reaction`, `get-chat-history` /
 * `chat-history`) are ignored by older clients.
 */

const MAX_REPLY_PREVIEW_LENGTH = 140;
const MAX_EMOJI_LENGTH = 16;
/** Messages and their reactions are kept in memory for as long as the room is. */
const MAX_MESSAGE_LENGTH = 4000;
const MAX_URL_LENGTH = 2000;
const MAX_NAME_LENGTH = 200;
const MAX_SONG_REACTION_LENGTH = 2000;

// Per person. Far above what a person does by hand.
const allowMessage = createRateLimiter({ limit: 20, windowMs: 10_000 });
const allowReaction = createRateLimiter({ limit: 60, windowMs: 10_000 });

const clip = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' ? value.slice(0, max) : undefined;

type UserId = string | number;

interface ReplyReference {
  id: string;
  senderId?: UserId;
  userName?: string;
  message?: string;
  messageType?: string;
}

interface ChatMessageSocketData {
  groupId: string;
  messageType?: string;
  gifUrl?: string;
  senderId?: UserId;
  profilePic?: string;
  userName?: string;
  message?: string;
  soundUrl?: string;
  soundName?: string;
  soundId?: string;
  replyTo?: Partial<ReplyReference> | null;
}

interface MessageReactionSocketData {
  groupId: string;
  messageId: string;
  emoji: string;
  userId?: UserId;
  userName?: string;
}

interface TypingSocketData {
  groupId: string;
  userId?: UserId;
  userName?: string;
  isTyping?: boolean;
}

const roomOf = (groupId: string) => `music-group-${groupId}`;

const isValidEmoji = (emoji: unknown): emoji is string =>
  typeof emoji === 'string' && emoji.length > 0 && emoji.length <= MAX_EMOJI_LENGTH;

const isMember = (group: MusicGroup, userId: UserId | undefined) =>
  findMember(group, userId) !== undefined;

/** Keeps only the fields needed to render a reply preview, with bounded size. */
const sanitizeReply = (replyTo: ChatMessageSocketData['replyTo']): ReplyReference | null => {
  if (!replyTo || typeof replyTo.id !== 'string' || !replyTo.id) return null;
  const { senderId } = replyTo;
  return {
    id: replyTo.id.slice(0, MAX_NAME_LENGTH),
    senderId: typeof senderId === 'number' ? senderId : clip(senderId, MAX_NAME_LENGTH),
    userName: clip(replyTo.userName, MAX_NAME_LENGTH),
    message: clip(replyTo.message, MAX_REPLY_PREVIEW_LENGTH),
    messageType: clip(replyTo.messageType, MAX_NAME_LENGTH) ?? 'text',
  };
};

/** Returns the group if chat is usable, emitting `feature-locked` when the plan doesn't allow it. */
const getChatGroup = (socket: Socket, groupId: string): MusicGroup | null => {
  const group = musicGroups.get(groupId);
  if (!group) return null;
  if (!group.features.realtimeChat) {
    socket.emit('feature-locked', {
      feature: 'realtimeChat',
      message: 'Real-time chat requires PRO plan',
    });
    return null;
  }
  return group;
};

export const setupChatHandlers = (io: Server, socket: Socket, userId?: UserId): void => {
  /** A host muted this person: they still listen, but don't chat or react. */
  const mutedIn = (groupId: string | undefined) => {
    const group = groupId ? musicGroups.get(groupId) : undefined;
    if (!group || !isMuted(group, userId)) return false;
    socket.emit('chat-blocked', { groupId, message: 'A host has muted you in this room' });
    return true;
  };

  /** The caller's place in a room. Only people in it may speak in it, and only as themselves. */
  const memberOf = (groupId: unknown) => {
    const group = typeof groupId === 'string' ? musicGroups.get(groupId) : undefined;
    return group ? findMember(group, userId) : undefined;
  };

  /** What the device sent if it names the caller (its type is what devices compare), else ours. */
  const ownId = (claimed: UserId | undefined, mine: UserId): UserId =>
    claimed != null && String(claimed) === String(mine) ? claimed : mine;

  socket.on('chat-message', (data: ChatMessageSocketData) => {
    const groupId = data?.groupId;
    const member = memberOf(groupId);
    if (!member || !getChatGroup(socket, groupId)) return;
    if (mutedIn(groupId) || !allowMessage(String(userId))) return;

    const replyTo = sanitizeReply(data.replyTo);

    const message = {
      id: generateMessageId(),
      groupId,
      senderId: ownId(data.senderId, member.userId),
      profilePic: member.profilePic,
      userName: member.userName,
      message: clip(data.message, MAX_MESSAGE_LENGTH),
      messageType: clip(data.messageType, MAX_NAME_LENGTH) || 'text',
      gifUrl: clip(data.gifUrl, MAX_URL_LENGTH) || null,
      soundUrl: clip(data.soundUrl, MAX_URL_LENGTH) || null,
      soundName: clip(data.soundName, MAX_NAME_LENGTH) || null,
      soundId:
        typeof data.soundId === 'number'
          ? data.soundId
          : clip(data.soundId, MAX_NAME_LENGTH) || null,
      ...(replyTo ? { replyTo } : {}),
      timestamp: Date.now(),
    };

    appendMessage(groupId, message);
    io.to(roomOf(groupId)).emit('new-message', message);
  });

  // History for people who join late or rejoin. Request/response so existing join
  // events (and the mobile app) are untouched.
  socket.on('get-chat-history', async (data: { groupId: string }) => {
    const groupId = data?.groupId;
    const group = groupId ? musicGroups.get(groupId) : undefined;
    if (!group || !group.features.realtimeChat || !isMember(group, userId)) return;
    socket.emit('chat-history', { groupId, messages: await getHistory(groupId) });
  });

  // Toggle a reaction on a chat message. The server owns reaction state and
  // broadcasts the message's full reactions so every client converges.
  socket.on('message-reaction', async (data: MessageReactionSocketData) => {
    const { groupId, messageId, emoji } = data || ({} as MessageReactionSocketData);
    if (!groupId || typeof messageId !== 'string' || !isValidEmoji(emoji)) return;
    if (mutedIn(groupId) || !allowReaction(String(userId))) return;

    const group = getChatGroup(socket, groupId);
    const reactorId = userId ?? data.userId;
    if (!group || reactorId == null || !isMember(group, reactorId)) return;

    const member = group.members.find((m) => String(m.userId) === String(reactorId));
    const result = await toggleReaction(groupId, messageId, emoji, {
      userId: reactorId,
      userName: member?.userName || data.userName,
    });
    if (!result) return;

    io.to(roomOf(groupId)).emit('message-reaction', {
      groupId,
      messageId,
      emoji,
      userId: reactorId,
      userName: member?.userName || data.userName,
      action: result.action,
      reactions: result.reactions,
      timestamp: Date.now(),
    });
  });

  // Song reactions (floating emoji). Payload shape unchanged; previously this event
  // was registered twice, which delivered every reaction twice.
  socket.on('song-reaction', (data: Record<string, unknown> & { groupId: string }) => {
    const member = memberOf(data?.groupId);
    if (!member || !isValidEmoji(data.emoji)) return;
    if (JSON.stringify(data).length > MAX_SONG_REACTION_LENGTH) return;
    if (mutedIn(data.groupId) || !allowReaction(String(userId))) return;
    socket.to(roomOf(data.groupId)).emit('song-reaction', {
      ...data,
      userId: ownId(data.userId as UserId | undefined, member.userId),
      userName: member.userName,
      id: generateMessageId(),
      timestamp: Date.now(),
    });
  });

  const relayTyping = (data: TypingSocketData, isTyping: boolean) => {
    const member = memberOf(data?.groupId);
    if (!member) return;
    socket.to(roomOf(data.groupId)).emit('user-typing', {
      userId: ownId(data.userId, member.userId),
      userName: member.userName,
      isTyping,
    });
  };

  // Original event name.
  socket.on('user-typing', (data: TypingSocketData) => relayTyping(data, Boolean(data?.isTyping)));
  // Event names actually emitted by the web and mobile clients.
  socket.on('typing-start', (data: TypingSocketData) => relayTyping(data, true));
  socket.on('typing-stop', (data: TypingSocketData) => relayTyping(data, false));
};
