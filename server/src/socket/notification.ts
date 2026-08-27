import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { getPushToken } from '@/features/auth/auth.controller';

const expo = new Expo();

export interface MessageNotificationData {
  senderName?: string;
  content?: string | null;
  chatid?: number | string;
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

  const recipientToken = await getPushToken(Number(recipientId));
  if (!recipientToken || !Expo.isExpoPushToken(recipientToken)) return;

  let notification: ExpoPushMessage | undefined;

  if (type === 'message') {
    notification = {
      to: recipientToken,
      sound: 'default',
      title: message.senderName ? `New message from ${message.senderName}` : 'New message',
      body: message.content || 'Sent an attachment',
      data: { chatid: message.chatid, senderId: message.senderid, type: 'message' },
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
