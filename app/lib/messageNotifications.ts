import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { ChatNotifications } from '@/modules/chat-notifications';

/**
 * Message notifications drawn by the app: one per conversation, holding its latest lines, like
 * WhatsApp. A new message replaces the conversation's notification instead of adding another.
 *
 * Android may run this in a background copy of the app with nothing else loaded, so what is
 * shown is kept in storage rather than memory.
 */

const MAX_LINES = 6;
/** New messages alert; a reply written into the notification only updates it, silently. */
export const MESSAGES_CHANNEL = 'messages';
export const QUIET_MESSAGES_CHANNEL = 'messages-quiet';

interface Line {
  /** Null for the user's own reply. */
  messageId: number | null;
  text: string;
  mine: boolean;
  /** A photo in the message, shown in the notification while it is the latest line. */
  imageUrl?: string | null;
}

interface Stored {
  senderName: string;
  lines: Line[];
  /** Messages since it was last cleared, which can be more than the lines kept. */
  count: number;
  lastMessageId: number;
}

export interface IncomingMessage {
  conversationId: number;
  messageId: number;
  senderName?: string | null;
  preview?: string | null;
  imageUrl?: string | null;
}

const storageKey = (conversationId: number) => `notif:chat:${conversationId}`;
export const notificationIdFor = (conversationId: number) => `chat-${conversationId}`;

const read = async (conversationId: number): Promise<Stored | null> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey(conversationId));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
};

/**
 * A small JPEG of a chat photo. Android decodes it itself, and may not read the WebP or AVIF that
 * Cloudinary would otherwise pick.
 */
const notificationImage = (url: string): string | null => {
  if (!url.startsWith('https://')) return null;
  const marker = '/image/upload/';
  if (!url.startsWith('https://res.cloudinary.com/') || !url.includes(marker)) return url;
  return url.replace(marker, `${marker}c_limit,w_720,h_720,f_jpg,q_auto/`);
};

const present = async (conversationId: number, stored: Stored, quiet: boolean) => {
  await AsyncStorage.setItem(storageKey(conversationId), JSON.stringify(stored)).catch(() => {});
  const fromThem = stored.lines.filter((line) => !line.mine).length;
  const identifier = notificationIdFor(conversationId);
  const body = stored.lines.map((line) => (line.mine ? `You: ${line.text}` : line.text)).join('\n');
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: stored.senderName,
      subtitle: stored.count > 1 ? `${stored.count} new messages` : undefined,
      body,
      data: {
        type: 'message',
        conversationId,
        // "Mark as read" reads up to the last message from them.
        messageId: stored.lastMessageId,
      },
      categoryIdentifier: fromThem > 0 ? 'chat_message' : undefined,
      sound: quiet ? false : 'default',
    },
    trigger: { channelId: quiet ? QUIET_MESSAGES_CHANNEL : MESSAGES_CHANNEL },
  });

  const latest = stored.lines[stored.lines.length - 1];
  const image =
    latest && !latest.mine && latest.imageUrl ? notificationImage(latest.imageUrl) : null;
  if (image && ChatNotifications) {
    await ChatNotifications.showPicture(identifier, image, body, latest.text).catch(() => false);
  }
};

/** Adds a message to its conversation's notification, or starts one. */
export const showMessageNotification = async (message: IncomingMessage): Promise<void> => {
  const stored = (await read(message.conversationId)) ?? {
    senderName: message.senderName || 'New message',
    lines: [],
    count: 0,
    lastMessageId: 0,
  };
  // The socket and a push can both bring the same message.
  if (stored.lines.some((line) => line.messageId === message.messageId)) return;

  stored.senderName = message.senderName || stored.senderName;
  stored.lines = [
    ...stored.lines,
    {
      messageId: message.messageId,
      text: message.preview || (message.imageUrl ? 'Photo' : 'New message'),
      mine: false,
      imageUrl: message.imageUrl ?? null,
    },
  ].slice(-MAX_LINES);
  stored.count += 1;
  stored.lastMessageId = Math.max(stored.lastMessageId, message.messageId);
  await present(message.conversationId, stored, false);
};

/**
 * Shows a reply written into the notification under the messages, which also tells Android the
 * reply went (it spins until the notification changes). With no text it is only redrawn.
 */
export const addReplyToNotification = async (conversationId: number, text: string | null) => {
  const stored = await read(conversationId);
  if (!stored) {
    await Notifications.dismissNotificationAsync(notificationIdFor(conversationId)).catch(() => {});
    return;
  }
  if (text) {
    stored.lines = [...stored.lines, { messageId: null, text, mine: true }].slice(-MAX_LINES);
    // What arrives after a reply starts a new count.
    stored.count = 0;
  }
  await present(conversationId, stored, true);
};

/** The conversation was read, here or on another device. */
export const clearMessageNotification = async (conversationId: number): Promise<void> => {
  await AsyncStorage.removeItem(storageKey(conversationId)).catch(() => {});
  await Notifications.dismissNotificationAsync(notificationIdFor(conversationId)).catch(() => {});
};
