import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { getPushTokenService } from '@/features/auth/services/user.service';
import { getRedis } from '@/utils/redis';

const expo = new Expo();

/**
 * Apps from 1.7.2 draw message notifications themselves, one per conversation with its recent
 * messages, like WhatsApp. They say so when they register their push token, and get a data-only
 * push to draw from. Older apps, or any device when Redis is unavailable, get an ordinary push.
 */
const groupedKey = (token: string) => `push:grouped:${token}`;
/** Set while a conversation has a notification on the user's phone, so reading it elsewhere clears it. */
const shownKey = (userId: number | string, conversationId: number) =>
  `push:shown:${userId}:${conversationId}`;
const SHOWN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const setGroupedMessagePushes = async (token: string, grouped: boolean): Promise<void> => {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (grouped) await redis.set(groupedKey(token), '1');
    else await redis.del(groupedKey(token));
  } catch (error) {
    console.error('Saving the push style failed:', (error as Error).message);
  }
};

const drawsOwnMessageNotifications = async (token: string): Promise<boolean> => {
  const redis = getRedis();
  if (!redis) return false;
  try {
    return (await redis.exists(groupedKey(token))) === 1;
  } catch {
    return false;
  }
};

const sendSilently = async (message: ExpoPushMessage) => {
  try {
    await expo.sendPushNotificationsAsync([message]);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

/**
 * The conversation was read on another device: take its notification off the phone. Sent only
 * when a notification for it went out since it was last read.
 */
export const clearMessageNotification = async (
  userId: number,
  conversationId: number
): Promise<void> => {
  const redis = getRedis();
  if (!redis) return;
  try {
    if ((await redis.del(shownKey(userId, conversationId))) === 0) return;
  } catch {
    return;
  }
  const token = await getPushTokenService(userId);
  if (!token || !Expo.isExpoPushToken(token) || !(await drawsOwnMessageNotifications(token))) {
    return;
  }
  await sendSilently({
    to: token,
    data: { type: 'message-read', conversationId },
    priority: 'high',
    _contentAvailable: true,
  });
};

export interface MessageNotificationData {
  senderName?: string;
  content?: string | null;
  conversationId?: number;
  /** When the message was sent, ISO. */
  sentAt?: string;
  /** The message the notification is about, for "Mark as read". */
  messageId?: number;
  senderid?: number | string;
  from?: string | number;
  name?: string;
  groupId?: string;
  groupName?: string;
  inviterName?: string;
  inviterPic?: string | null;
  inviterId?: string | number;
}

export async function sendPushNotification(
  recipientId: number | string | undefined,
  message: MessageNotificationData,
  type: 'message' | 'call' | 'group-invite' = 'message'
): Promise<void> {
  if (!recipientId) return;

  const recipientToken = await getPushTokenService(Number(recipientId));
  if (!recipientToken || !Expo.isExpoPushToken(recipientToken)) return;

  let notification: ExpoPushMessage | undefined;

  if (type === 'message' && (await drawsOwnMessageNotifications(recipientToken))) {
    // No title or body: the app's background task draws it (app/lib/messageNotifications).
    notification = {
      to: recipientToken,
      data: {
        type: 'message',
        conversationId: message.conversationId,
        messageId: message.messageId,
        senderId: message.senderid,
        senderName: message.senderName,
        preview: message.content,
        sentAt: message.sentAt,
      },
      priority: 'high',
      _contentAvailable: true,
    };
    if (message.conversationId) {
      getRedis()
        ?.set(shownKey(recipientId, message.conversationId), '1', 'EX', SHOWN_TTL_SECONDS)
        .catch(() => {});
    }
  } else if (type === 'message') {
    notification = {
      to: recipientToken,
      sound: 'default',
      title: message.senderName || 'New message',
      body: message.content || 'Sent a photo',
      data: {
        conversationId: message.conversationId,
        messageId: message.messageId,
        senderId: message.senderid,
        type: 'message',
      },
      channelId: 'messages',
      categoryId: 'chat_message',
      priority: 'high',
    };
  } else if (type === 'call') {
    notification = {
      to: recipientToken,
      sound: 'default',
      title: `Incoming call from ${message.name}`,
      body: 'Tap to answer',
      data: { callFrom: message.from, callType: 'video', type: 'call' },
      channelId: 'calls',
      priority: 'high',
      categoryId: 'call',
    };
  } else if (type === 'group-invite') {
    notification = {
      to: recipientToken,
      sound: 'default',
      title: `Group Invite from ${message.inviterName || 'a friend'}`,
      body: `Join "${message.groupName || 'Music Group'}" to listen together!`,
      data: {
        type: 'group-invite',
        groupId: message.groupId,
        groupName: message.groupName,
        inviterName: message.inviterName,
        inviterPic: message.inviterPic,
        inviterId: message.inviterId,
      },
      channelId: 'group-invites',
      categoryId: 'group_invite',
      priority: 'high',
    };
  }

  if (!notification) return;

  try {
    await expo.sendPushNotificationsAsync([notification]);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}
