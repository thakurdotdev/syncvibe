import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/utils/registerForPushNotificationsAsync';
import { useChat } from './SocketContext';
import { useUser } from './UserContext';
import useApi from '@/utils/hooks/useApi';
import { router } from 'expo-router';

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
  const { users, setCurrentChat } = useChat();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  const [pendingChatId, setPendingChatId] = useState<string | null>(null);

  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();
  const appInitialized = useRef(false);

  // Handle initial notification (on app launch)
  useEffect(() => {
    if (!appInitialized.current) {
      appInitialized.current = true;

      // Check if app was opened from a notification
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (response) {
            const chatid = response.notification.request.content.data?.chatid;
            if (chatid) {
              setPendingChatId(chatid);
            }
          }
        })
        .catch((err) => console.error('Error checking last notification:', err));
    }
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => setExpoPushToken(token || null));

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response received:', response);

      const chatid = response.notification.request.content.data?.chatid;

      // Instead of trying to process immediately, store the chatid
      if (chatid) {
        console.log('Setting pending chat ID from notification tap:', chatid);
        setPendingChatId(chatid);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Process pending notifications when users and user are available
  useEffect(() => {
    if (pendingChatId && users.length > 0 && user?.userid) {
      const chat = users.find((u) => u.chatid === pendingChatId);
      if (chat) {
        setCurrentChat(chat);
        setPendingChatId(null);

        // Slight delay to ensure context updates before navigation
        setTimeout(() => {
          router.push('/message');
        }, 100);
      } else {
        console.log('No matching chat found for ID:', pendingChatId);
      }
    }
  }, [pendingChatId, users, user, setCurrentChat]);

  useEffect(() => {
    if (expoPushToken) {
      if (user && (!user?.expoPushToken || user.expoPushToken !== expoPushToken)) setPushToken();
    }
  }, [expoPushToken, user]);

  const setPushToken = async () => {
    if (expoPushToken) {
      try {
        const response = await api.post('/api/mobile/pushToken', {
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
