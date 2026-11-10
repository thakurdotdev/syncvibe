import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { api } from '@/utils/hooks/useApi';

/**
 * The buttons on a message notification. Android runs this file's task in the background when
 * one is pressed with the app closed, so a reply or "mark as read" works without opening the app.
 * With the app open, NotificationContext calls `handleChatAction` itself.
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
      if (body) {
        await api.post(`/api/chat/conversations/${conversationId}/messages`, {
          clientId: replyClientId(identifier),
          body,
        });
      }
    } else if (messageId) {
      await api.post(`/api/chat/conversations/${conversationId}/read`, { messageId });
    }
  } catch (error) {
    console.error('Notification action failed:', error);
    if (actionIdentifier === REPLY_ACTION) {
      await reportFailedReply(content.title || 'message', conversationId);
    }
  } finally {
    // Android keeps a spinner on the reply box until the notification goes.
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
  }
  return true;
};

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  await handleChatAction(data);
});

/** Must run when the bundle loads, before anything renders: see index.ts. */
export const registerNotificationActionTask = () =>
  Notifications.registerTaskAsync(TASK).catch((error) =>
    console.error('Registering the notification task failed:', error)
  );
