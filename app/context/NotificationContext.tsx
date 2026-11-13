import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/utils/registerForPushNotificationsAsync';
import { handleChatAction, MARK_READ_ACTION, REPLY_ACTION } from '@/lib/notificationActions';
import { openConversation } from '@/lib/chatScreen';
import { useUser } from './UserContext';
import useApi from '@/utils/hooks/useApi';
import { router } from 'expo-router';
import { runAfterIdle } from '@/utils/runAfterIdle';

type NotificationContextType = {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
};

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  notification: null,
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const { user } = useUser();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appInitialized = useRef(false);

  // Centralized handler for notification interactions (taps, quick reply, join/decline)
  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse) => {
    const { actionIdentifier } = response;
    const data = response.notification.request.content.data as Record<string, any> | undefined;

    const conversationId = Number(data?.conversationId) || null;
    const type = data?.type as string | undefined;

    // 1. Reply and Mark as read, without opening a screen. The same code runs in the
    // background when the app is closed (lib/notificationActions).
    if (actionIdentifier === REPLY_ACTION || actionIdentifier === MARK_READ_ACTION) {
      void handleChatAction(response);
      return;
    }

    // 2. Interactive Action: Group Invite Join or Default Tap on Group Invite
    if (
      actionIdentifier === 'JOIN_GROUP_ACTION' ||
      type === 'group-invite' ||
      type === 'group_invite'
    ) {
      setTimeout(() => {
        router.push('/(tabs)/group-music');
      }, 150);
      return;
    }

    // 3. Interactive Action: Decline (no navigation needed)
    if (actionIdentifier === 'DECLINE_GROUP_ACTION' || actionIdentifier === 'DECLINE_CALL_ACTION') {
      return;
    }

    // 4. Default / Open Chat Action: Route to specific conversation. The screen loads the
    // conversation itself, so this works on a cold start before the list has arrived.
    if (conversationId) {
      setTimeout(() => openConversation(conversationId), 150);
    }
  }, []);

  // Handle initial notification on cold start (using non-deprecated getLastNotificationResponse)
  useEffect(() => {
    if (!appInitialized.current) {
      appInitialized.current = true;

      try {
        const lastResponse = Notifications.getLastNotificationResponse();
        if (lastResponse) {
          handleNotificationResponse(lastResponse);
        }
      } catch (err) {
        console.error('Error retrieving last notification response:', err);
      }
    }
  }, [handleNotificationResponse]);

  useEffect(() => {
    let cancelled = false;
    const task = runAfterIdle(() => {
      registerForPushNotificationsAsync().then((token) => {
        if (!cancelled) setExpoPushToken(token || null);
      });
    });

    notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
      setNotification(notif);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse
    );

    return () => {
      cancelled = true;
      task.cancel();
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [handleNotificationResponse]);

  // Sent on every start, not only when the token changes: it also tells the server this version
  // draws its own message notifications, which an install updated from an older one has to say.
  const userId = user?.userid;
  useEffect(() => {
    if (!expoPushToken || !userId) return;
    api
      .post('/api/mobile/pushToken', { expoPushToken, groupedMessages: true })
      .catch((error) => console.error('Error saving push token:', error));
  }, [expoPushToken, userId, api]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
