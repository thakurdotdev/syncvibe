const GROUP_WINDOW_MS = 5 * 60 * 1000;

const EMOJI_ONLY_REGEX =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}️)(?:\s*(?:\p{Emoji_Presentation}|\p{Emoji}️)){0,2}$/u;

const VIDEO_URL_REGEX = /\.(mp4|webm|mov)(\?.*)?$/i;

export const isActivityMessage = (msg) => msg?.type === 'activity';
export const isGifMessage = (msg) => msg.messageType === 'gif' && Boolean(msg.gifUrl);
export const isSoundMessage = (msg) => msg.messageType === 'sound' || Boolean(msg.soundUrl);
export const isVideoUrl = (url) => typeof url === 'string' && VIDEO_URL_REGEX.test(url);

export const isEmojiOnly = (text) => {
  if (!text || text.length > 20) return false;
  return EMOJI_ONLY_REGEX.test(text.trim());
};

export const isOwnMessage = (msg, currentUserId) => String(msg.senderId) === String(currentUserId);

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatMessageTime = (timestamp) =>
  timestamp ? timeFormatter.format(new Date(timestamp)) : '';

/** Two messages belong to the same visual group when the same person sent them close together. */
const isSameGroup = (a, b) =>
  Boolean(a && b) &&
  !isActivityMessage(a) &&
  !isActivityMessage(b) &&
  String(a.senderId) === String(b.senderId) &&
  (!a.timestamp || !b.timestamp || b.timestamp - a.timestamp < GROUP_WINDOW_MS);

/**
 * Converts raw socket messages into render items with grouping metadata,
 * so the list component stays purely presentational.
 */
export const buildChatItems = (messages, currentUserId) =>
  messages.map((msg, index) => {
    const key = msg.id || `${msg.timestamp ?? 'msg'}-${index}`;
    if (isActivityMessage(msg)) return { kind: 'activity', key, msg };

    return {
      kind: 'message',
      key,
      msg,
      isOwn: isOwnMessage(msg, currentUserId),
      startsGroup: !isSameGroup(messages[index - 1], msg),
      endsGroup: !isSameGroup(msg, messages[index + 1]),
    };
  });

export const MESSAGE_REACTIONS = ['❤️', '😂', '🔥', '👍', '😮', '😢'];

const PREVIEW_LENGTH = 120;

/** Short, human-readable summary of a message (used for reply quotes). */
export const getMessagePreview = (msg) => {
  if (!msg) return '';
  if (isSoundMessage(msg)) return `🔊 ${msg.soundName || 'Sound effect'}`;
  if (isGifMessage(msg)) return 'GIF';
  return (msg.message || '').slice(0, PREVIEW_LENGTH);
};

/** The compact reference sent with a reply (the server re-validates and truncates it). */
export const buildReplyReference = (msg) => ({
  id: msg.id,
  senderId: msg.senderId,
  userName: msg.userName,
  message: getMessagePreview(msg),
  messageType: msg.messageType || 'text',
});

/** reactions: { emoji: [{ userId, userName }] } → sorted chips with "did I react" flag. */
export const summarizeReactions = (reactions, currentUserId) =>
  Object.entries(reactions || {})
    .filter(([, users]) => users?.length)
    .map(([emoji, users]) => ({
      emoji,
      count: users.length,
      reactedByMe: users.some((u) => String(u.userId) === String(currentUserId)),
      names: users.map((u) => u.userName).filter(Boolean),
    }))
    .sort((a, b) => b.count - a.count);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when the text @-mentions the given display name (case-insensitive). */
export const mentionsUser = (text, userName) => {
  if (!text || !userName) return false;
  const firstName = userName.split(' ')[0];
  return new RegExp(`@(${escapeRegExp(userName)}|${escapeRegExp(firstName)})\\b`, 'i').test(text);
};
