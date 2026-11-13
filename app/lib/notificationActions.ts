import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from '@/utils/hooks/useApi';
import {
  addReplyToNotification,
  clearMessageNotification,
  showMessageNotification,
} from './messageNotifications';

/**
 * The buttons on a message notification, and the data-only pushes message notifications are drawn
 * from. Android runs this file's task in the background when either arrives with the app closed,
 * so nothing needs the app open. With the app open, NotificationContext calls `handleChatAction`.
 *
 * Both can see the same press: with the app in the background Android runs the task and also tells
 * the app's listener, and an app opened later is told about the last press again. So each press is
 * handled once (`once`), and a reply's id comes from the press, which the server stores once.
 */

export const REPLY_ACTION = 'REPLY_ACTION';
export const MARK_READ_ACTION = 'MARK_READ_ACTION';
export const OPEN_CHAT_ACTION = 'OPEN_CHAT_ACTION';

const TASK = 'syncvibe-notification-actions';

const HANDLED_KEY = 'notif:handled';
const HANDLED_KEPT = 30;

/** A short hash, to tell presses apart in ids and storage keys. */
const hash = (text: string) => {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(36);
};

/**
 * The same id for the same press, wherever it is handled, and a new one for every press. The
 * notification's identifier is one per conversation, so on its own it would give every reply in
 * a conversation the same id, and the server would keep only the first. The time it was posted
 * changes each time it is redrawn, a reply included.
 */
const pressKey = (actionIdentifier: string, notification: Notifications.Notification, text = '') =>
  `${actionIdentifier}:${notification.request.identifier}:${notification.date ?? ''}:${hash(text)}`;

const replyClientId = (conversationId: number, key: string) =>
  `ntf-${conversationId}-${hash(key)}-${hash(`${key}#`)}`;

const running = new Map<string, Promise<void>>();

/**
 * Runs `work` once for a press. Two handlers in this copy of the app share the first one's run;
 * a press already handled, by this copy or a background one, is skipped.
 */
const once = (key: string, work: () => Promise<void>): Promise<void> => {
  const current = running.get(key);
  if (current) return current;
  const run = (async () => {
    const handled = await readHandled();
    if (handled.includes(key)) return;
    // Before the work, so a copy of the app opened meanwhile doesn't start it again.
    await AsyncStorage.setItem(
      HANDLED_KEY,
      JSON.stringify([...handled, key].slice(-HANDLED_KEPT))
    ).catch(() => {});
    await work();
  })().finally(() => running.delete(key));
  running.set(key, run);
  return run;
};

const readHandled = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * The notification's data. The app's listener gets it parsed, but the background task gets what
 * Android stored: for a notification the app drew, that is the JSON text in `dataString`.
 */
const dataOf = (content: Notifications.NotificationContent): Record<string, unknown> => {
  const raw = (content as { dataString?: unknown }).dataString;
  if (content.data && Object.keys(content.data).length > 0) return content.data;
  if (typeof raw !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** Lets the user know a reply didn't go, since nothing on screen would show it. */
const reportFailedReply = (title: string, conversationId: number) =>
  Notifications.scheduleNotificationAsync({
    content: {
      title: `Reply to ${title} not sent`,
      body: 'Open SyncVibe to try again.',
      data: { type: 'message', conversationId },
    },
    trigger: null,
  }).catch(() => {});

/**
 * Handles Reply and Mark as read. Returns false for anything else, which the caller deals with
 * (opening the conversation, invites, calls).
 */
export const handleChatAction = async (response: {
  actionIdentifier: string;
  userText?: string;
  notification: Notifications.Notification;
}): Promise<boolean> => {
  const { actionIdentifier, userText, notification } = response;
  if (actionIdentifier !== REPLY_ACTION && actionIdentifier !== MARK_READ_ACTION) return false;

  const { identifier, content } = notification.request;
  const data = dataOf(content);
  const conversationId = Number(data.conversationId);
  const messageId = Number(data.messageId);
  const body = userText?.trim() ?? '';
  const key = pressKey(actionIdentifier, notification, body);

  await once(key, async () => {
    try {
      if (!conversationId) throw new Error('The notification has no conversation');
      if (actionIdentifier === REPLY_ACTION) {
        if (!body) {
          // Nothing to send, but Android keeps a spinner on the reply box until it is redrawn.
          await addReplyToNotification(conversationId, null);
          return;
        }
        await api.post(`/api/chat/conversations/${conversationId}/messages`, {
          clientId: replyClientId(conversationId, key),
          body,
        });
        // The reply joins the conversation's notification, which also stops Android's spinner.
        await addReplyToNotification(conversationId, body);
      } else {
        if (messageId) {
          await api.post(`/api/chat/conversations/${conversationId}/read`, { messageId });
        }
        await clearMessageNotification(conversationId);
      }
    } catch (error) {
      console.error('Notification action failed:', error);
      // Android keeps a spinner on the reply box until the notification goes.
      await Notifications.dismissNotificationAsync(identifier).catch(() => {});
      if (actionIdentifier === REPLY_ACTION && conversationId) {
        await reportFailedReply(content.title || 'message', conversationId);
      }
    }
  });
  return true;
};

/** The payload of a data-only push: the server sends these to apps that draw their own. */
const parsePush = (data: Record<string, unknown>): Record<string, unknown> | null => {
  const raw = data.dataString ?? data.body;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/** A data-only push: draw the message, or clear a conversation read somewhere else. */
export const handleChatPush = async (payload: Record<string, unknown>): Promise<void> => {
  const conversationId = Number(payload.conversationId);
  if (!conversationId) return;
  if (payload.type === 'message-read') {
    await clearMessageNotification(conversationId);
  } else if (payload.type === 'message' && Number(payload.messageId)) {
    const messageId = Number(payload.messageId);
    // It reached this phone: the sender's tick turns into two, as it would over the socket.
    // Alongside drawing, which can wait a few seconds for a photo to download.
    await Promise.all([
      showMessageNotification({
        conversationId,
        messageId,
        senderName: typeof payload.senderName === 'string' ? payload.senderName : null,
        preview: typeof payload.preview === 'string' ? payload.preview : null,
        imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : null,
      }),
      api
        .post(`/api/chat/conversations/${conversationId}/delivered`, { messageId })
        .catch(() => {}),
    ]);
  }
};

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  if ('actionIdentifier' in data) {
    await handleChatAction(data);
    return;
  }
  const payload = parsePush(data.data ?? {});
  if (payload) await handleChatPush(payload).catch(() => {});
});

/** Must run when the bundle loads, before anything renders: see index.ts. */
export const registerNotificationActionTask = () =>
  Notifications.registerTaskAsync(TASK).catch((error) =>
    console.error('Registering the notification task failed:', error)
  );
