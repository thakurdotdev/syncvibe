const { Expo } = require("expo-server-sdk");
const { getPushToken } = require("../controllers/auth/loginUser");

const expo = new Expo();

async function sendPushNotification(recipientId, message, type = "message") {
  if (!recipientId) return;

  const recipientToken = await getPushToken(recipientId);
  if (!recipientToken) return;

  let notification;

  if (type === "message") {
    notification = {
      to: recipientToken,
      sound: "default",
      title: `New message from ${message.senderName}`,
      body: message.content || "Sent an attachment",
      data: { chatid: message.chatid },
    };
  } else if (type === "call") {
    notification = {
      to: recipientToken,
      sound: "default",
      title: `Incoming call from ${message.name}`,
      body: "Tap to open the app",
      data: { callFrom: message.from, callType: "video" },
      priority: "high",
    };
  }

  try {
    await expo.sendPushNotificationsAsync([notification]);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

module.exports = {
  sendPushNotification,
};
