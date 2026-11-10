import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/utils/registerForPushNotificationsAsync';
import { sendOverHttp } from '@/lib/chat';
import { useChatStore } from '@/stores/chatStore';
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
    const { actionIdentifier, userText } = response;
    const data = response.notification.request.content.data as Record<string, any> | undefined;

    const conversationId = Number(data?.conversationId) || null;
    const type = data?.type as string | undefined;

    // 1. Interactive Action: Quick Reply (WhatsApp-style inline response). The app may be in
    // the background with no socket, so this one goes over HTTP.
    if (actionIdentifier === 'REPLY_ACTION' && userText?.trim()) {
      if (conversationId) {
        sendOverHttp(conversationId, userText.trim()).catch((error) =>
          console.error('Replying from a notification failed:', error)
        );
      }
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
      useChatStore.getState().setActive(conversationId);
      setTimeout(() => router.push('/message'), 150);
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

  useEffect(() => {
    if (expoPushToken) {
      if (user && (!user?.expoPushToken || user.expoPushToken !== expoPushToken)) setPushToken();
    }
  }, [expoPushToken, user]);

  const setPushToken = async () => {
    if (expoPushToken) {
      try {
        await api.post('/api/mobile/pushToken', {
          expoPushToken,
        });
      } catch (error) {
        console.error('Error saving push token:', error);
      }
    }
  };

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
