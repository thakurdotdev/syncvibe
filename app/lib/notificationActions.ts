import * as Crypto from 'expo-crypto';
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
 * Both can see the same press, so everything here is safe to run twice: a reply's id comes from
 * the notification, which the server stores once, and read positions only move forward.
 */

export const REPLY_ACTION = 'REPLY_ACTION';
export const MARK_READ_ACTION = 'MARK_READ_ACTION';
export const OPEN_CHAT_ACTION = 'OPEN_CHAT_ACTION';

const TASK = 'syncvibe-notification-actions';

/** The same id for the same press, wherever it is handled. */
const replyClientId = (notificationId: string) => {
  const safe = notificationId.replace(/[^A-Za-z0-9_-]/g, '').slice(-56);
  return safe.length >= 8 ? `ntf-${safe}` : Crypto.randomUUID();
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
  const data = (content.data ?? {}) as Record<string, unknown>;
  const conversationId = Number(data.conversationId);
  const messageId = Number(data.messageId);
  if (!conversationId) return true;

  try {
    if (actionIdentifier === REPLY_ACTION) {
      const body = userText?.trim();
      if (!body) return true;
      await api.post(`/api/chat/conversations/${conversationId}/messages`, {
        clientId: replyClientId(identifier),
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
    if (actionIdentifier === REPLY_ACTION) {
      await reportFailedReply(content.title || 'message', conversationId);
    }
  }
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
    await showMessageNotification({
      conversationId,
      messageId,
      senderName: typeof payload.senderName === 'string' ? payload.senderName : null,
      preview: typeof payload.preview === 'string' ? payload.preview : null,
    });
    // It reached this phone: the sender's tick turns into two, as it would over the socket.
    await api
      .post(`/api/chat/conversations/${conversationId}/delivered`, { messageId })
      .catch(() => {});
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
