import { Platform } from "react-native"
import * as Notifications from "expo-notifications"
import Constants from "expo-constants"
import * as Device from "expo-device"

export async function setupNotificationChannelsAndCategories() {
  if (Platform.OS === "android") {
    // 1. Messages Channel
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      description: "Direct and chat messages",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6366F1",
      enableLights: true,
      showBadge: true,
      sound: "default",
    })

    // 2. Group Invites Channel
    await Notifications.setNotificationChannelAsync("group-invites", {
      name: "Group Music Invites",
      description: "Invitations to listen to music together",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#6366F1",
      enableLights: true,
      showBadge: true,
      sound: "default",
    })

    // 3. Calls Channel
    await Notifications.setNotificationChannelAsync("calls", {
      name: "Calls",
      description: "Incoming voice and video calls",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 500, 500],
      lightColor: "#22C55E",
      enableLights: true,
      showBadge: true,
      sound: "default",
    })

    // 4. Default fallback channel
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default Notifications",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  // Register interactive notification action categories (WhatsApp-style quick reply and action buttons)
  try {
    // Chat Message Category: Quick Reply + Open Chat
    await Notifications.setNotificationCategoryAsync("chat_message", [
      {
        identifier: "REPLY_ACTION",
        buttonTitle: "Reply",
        textInput: {
          submitButtonTitle: "Send",
          placeholder: "Type a reply...",
        },
        options: {
          opensAppToForeground: false,
        },
      },
      {
        identifier: "OPEN_CHAT_ACTION",
        buttonTitle: "Open Chat",
        options: {
          opensAppToForeground: true,
        },
      },
    ])

    // Group Invite Category: Join / Decline
    await Notifications.setNotificationCategoryAsync("group_invite", [
      {
        identifier: "JOIN_GROUP_ACTION",
        buttonTitle: "Join Room",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: "DECLINE_GROUP_ACTION",
        buttonTitle: "Decline",
        options: {
          isDestructive: true,
          opensAppToForeground: false,
        },
      },
    ])

    // Call Category: Answer / Decline
    await Notifications.setNotificationCategoryAsync("call", [
      {
        identifier: "ANSWER_CALL_ACTION",
        buttonTitle: "Answer",
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: "DECLINE_CALL_ACTION",
        buttonTitle: "Decline",
        options: {
          isDestructive: true,
          opensAppToForeground: false,
        },
      },
    ])
  } catch (error) {
    console.error("Error setting notification categories:", error)
  }
}

export async function registerForPushNotificationsAsync() {
  let token

  await setupNotificationChannelsAndCategories()

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== "granted") {
      console.log("Failed to get push token for push notification!")
      return
    }

    token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })
      .then((response) => {
        return response.data
      })
      .catch((error) => {
        console.error("Error getting push token:", error)
        return null
      })
  } else {
    console.log("Must use physical device for Push Notifications")
  }

  return token
}
