const { Expo } = require("expo-server-sdk");
const { getPushToken } = require("../../controllers/auth/loginUser");

const expo = new Expo();

/**
 * Send push notification to a specific user
 * @param {string} recipientId - The ID of the recipient
 * @param {object} message - The message data
 */
async function sendPushNotification(recipientId, message) {
  if (!recipientId) return;

  const recipientToken = await getPushToken(recipientId);
  if (!recipientToken) return;

  let title, body, data;

  // Format notification based on message type
  if (message.type === "call") {
    title = `Incoming Call`;
    body = `${message.senderName} is calling you`;
    data = {
      type: "call",
      callerId: message.chatid,
      callerName: message.senderName,
    };
  } else {
    // Default to chat message format
    title = `New message from ${message.senderName}`;
    body = message.content || "Sent an attachment";
    data = { chatid: message.chatid };
  }

  const notification = {
    to: recipientToken,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
  };

  try {
    await expo.sendPushNotificationsAsync([notification]);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

module.exports = {
  sendPushNotification,
};
