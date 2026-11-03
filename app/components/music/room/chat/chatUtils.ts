import type { Message, MessageReactions, ReplyRef } from '@/stores/groupMusic/types';

/** Reactions offered in the long-press menu (same set as the web room). */
export const QUICK_REACTIONS = ['❤️', '😂', '🔥', '😮', '😢', '👍'] as const;

const EMOJI_ONLY =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}️)(?:\s*(?:\p{Emoji_Presentation}|\p{Emoji}️)){0,2}$/u;

export const isEmojiOnly = (text?: string) =>
  !!text && text.length <= 20 && EMOJI_ONLY.test(text.trim());

export const isActivity = (m: Message) => m.type === 'activity' || m.messageType === 'activity';
export const isGif = (m: Message) => m.messageType === 'gif' && !!m.gifUrl;
export const isSound = (m: Message) => m.messageType === 'sound' || !!m.soundUrl;

export const sameUser = (a?: number | string, b?: number | string) =>
  a != null && b != null && String(a) === String(b);

/** One-line preview used in reply quotes and the composer's reply bar. */
export const previewText = (
  m: Pick<Message, 'message' | 'messageType' | 'soundName'> | ReplyRef
) => {
  if (m.messageType === 'gif') return 'GIF';
  if (m.messageType === 'sound')
    return `🔊 ${('soundName' in m && m.soundName) || m.message || 'Sound'}`;
  return (m.message || '').replace(/\s+/g, ' ').trim();
};

/** The compact reference sent with a reply (mirrors the server's sanitizeReply). */
export const toReplyRef = (m: Message): ReplyRef => ({
  id: m.id,
  senderId: m.senderId,
  userName: m.userName,
  message: previewText(m).slice(0, 140),
  messageType: m.messageType || 'text',
});

export type ReactionChip = { emoji: string; count: number; mine: boolean; names: string[] };

/** Reaction map → chips in a stable order, flagging the ones you've added. */
export const toReactionChips = (
  reactions: MessageReactions | undefined,
  myId?: number | string
): ReactionChip[] =>
  Object.entries(reactions || {})
    .filter(([, people]) => people?.length)
    .map(([emoji, people]) => ({
      emoji,
      count: people.length,
      mine: people.some((p) => sameUser(p.userId, myId)),
      names: people.map((p) => p.userName || 'Someone'),
    }));

export const formatClock = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** Messages from the same person within this window are grouped under one name/avatar. */
export const GROUP_WINDOW_MS = 3 * 60 * 1000;

export const startsGroup = (m: Message, prev?: Message) =>
  !prev ||
  isActivity(prev) ||
  !sameUser(prev.senderId, m.senderId) ||
  m.timestamp - prev.timestamp > GROUP_WINDOW_MS;
