import type { Server, Socket } from 'socket.io';
import { appendMessage, getHistory, toggleReaction } from './chat-history';
import { generateMessageId, isMuted, musicGroups, type MusicGroup } from './state';

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
  userId != null && group.members.some((m) => String(m.userId) === String(userId));

/** Keeps only the fields needed to render a reply preview, with bounded size. */
const sanitizeReply = (replyTo: ChatMessageSocketData['replyTo']): ReplyReference | null => {
  if (!replyTo || typeof replyTo.id !== 'string' || !replyTo.id) return null;
  return {
    id: replyTo.id,
    senderId: replyTo.senderId,
    userName: typeof replyTo.userName === 'string' ? replyTo.userName : undefined,
    message:
      typeof replyTo.message === 'string'
        ? replyTo.message.slice(0, MAX_REPLY_PREVIEW_LENGTH)
        : undefined,
    messageType: typeof replyTo.messageType === 'string' ? replyTo.messageType : 'text',
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

  socket.on('chat-message', (data: ChatMessageSocketData) => {
    const { groupId, messageType, gifUrl } = data;
    // Unknown groups keep the previous behaviour (message still relayed to the room).
    if (musicGroups.has(groupId) && !getChatGroup(socket, groupId)) return;
    if (mutedIn(groupId)) return;

    const replyTo = sanitizeReply(data.replyTo);

    const message = {
      id: generateMessageId(),
      groupId,
      senderId: data.senderId,
      profilePic: data.profilePic,
      userName: data.userName,
      message: data.message,
      messageType: messageType || 'text',
      gifUrl: gifUrl || null,
      soundUrl: data.soundUrl || null,
      soundName: data.soundName || null,
      soundId: data.soundId || null,
      ...(replyTo ? { replyTo } : {}),
      timestamp: Date.now(),
    };

    if (musicGroups.has(groupId)) appendMessage(groupId, message);
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
    if (mutedIn(groupId)) return;

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
    if (!data?.groupId || !musicGroups.has(data.groupId) || !isValidEmoji(data.emoji)) return;
    if (mutedIn(data.groupId)) return;
    socket.to(roomOf(data.groupId)).emit('song-reaction', {
      ...data,
      id: generateMessageId(),
      timestamp: Date.now(),
    });
  });

  const relayTyping = (data: TypingSocketData, isTyping: boolean) => {
    if (!data?.groupId) return;
    socket.to(roomOf(data.groupId)).emit('user-typing', {
      userId: data.userId ?? userId,
      userName: data.userName,
      isTyping,
    });
  };

  // Original event name.
  socket.on('user-typing', (data: TypingSocketData) => relayTyping(data, Boolean(data?.isTyping)));
  // Event names actually emitted by the web and mobile clients.
  socket.on('typing-start', (data: TypingSocketData) => relayTyping(data, true));
  socket.on('typing-stop', (data: TypingSocketData) => relayTyping(data, false));
};
