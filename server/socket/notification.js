const { Expo } = require('expo-server-sdk');
const { getPushToken } = require('../controllers/auth/loginUser');

const expo = new Expo();

async function sendPushNotification(recipientId, message, type = 'message') {
  if (!recipientId) return;

  const recipientToken = await getPushToken(recipientId);
  if (!recipientToken || !Expo.isExpoPushToken(recipientToken)) return;

  let notification;

  if (type === 'message') {
    notification = {
      to: recipientToken,
      sound: 'default',
      title: message.senderName ? `New message from ${message.senderName}` : 'New message',
      body: message.content || 'Sent an attachment',
      data: { chatid: message.chatid, senderId: message.senderid, type: 'message' },
      channelId: 'messages',
      _category: 'chat_message',
      categoryIdentifier: 'chat_message',
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
      priority: 'max',
      _category: 'call',
      categoryIdentifier: 'call',
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
      _category: 'group_invite',
      categoryIdentifier: 'group_invite',
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

module.exports = {
  sendPushNotification,
};
