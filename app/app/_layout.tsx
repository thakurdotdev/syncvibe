import AppUpdateModal from '@/components/AppUpdateModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import Player from '@/components/music/Player';
import PlayerInitializer from '@/components/music/PlayerInitializer';
import { AppUpdateProvider } from '@/context/AppUpdateContext';
import { GroupMusicProvider } from '@/context/GroupMusicContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ChatProvider } from '@/context/SocketContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { typography } from '@/theme/typography';
import { ToastProvider } from '@/context/ToastContext';
import { UserProvider } from '@/context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from '@rntp/player';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { NotificationBehavior } from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { Stack } from 'expo-router';
import { ObserveRoot, useObserve } from 'expo-observe';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

SplashScreen.preventAutoHideAsync();

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowAlert: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TrackPlayer.registerBackgroundEventHandler(() => async (event) => {
  const { handleBackgroundPlaybackEvent } = await import('../service');
  await handleBackgroundPlaybackEvent(event);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      gcTime: 24 * 60 * 60 * 1000,
      staleTime: 60 * 1000,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1 }}>
          <ThemeProvider>
            <ToastProvider>
              <AppUpdateProvider>
                <PersistQueryClientProvider
                  client={queryClient}
                  persistOptions={{ persister: asyncStoragePersister }}
                >
                  <UserProvider>
                    <ChatProvider>
                      <NotificationProvider>
                        <GroupMusicProvider>
                          <PlayerInitializer />
                          <RootLayoutNav />
                        </GroupMusicProvider>
                      </NotificationProvider>
                    </ChatProvider>
                  </UserProvider>
                </PersistQueryClientProvider>
              </AppUpdateProvider>
            </ToastProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const { colors, theme, isLoading: themeLoading } = useTheme();
  const { markInteractive } = useObserve();

  useEffect(() => {
    if (!themeLoading) {
      SplashScreen.hideAsync();
      markInteractive();
    }
  }, [themeLoading, markInteractive]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {
      // System UI background updates are unavailable on some web/dev runtimes.
    });
  }, [colors.background]);

  return (
    <>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        translucent
        animated
      />
      <Stack
        screenOptions={{
          animation: 'default',
          gestureEnabled: false,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.foreground,
          headerTitleStyle: {
            ...typography.headingMd,
          },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name='index'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='login'
          options={{
            title: 'Login',
            presentation: 'modal',
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name='(tabs)'
          options={{
            headerShown: false,
            gestureEnabled: false,
            animation: 'none',
          }}
        />
        <Stack.Screen
          name='playlists'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='search'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='albums'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='artist'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='user-playlist'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='message'
          options={{
            headerShown: false,
            title: 'Message',
          }}
        />
        <Stack.Screen
          name='music-language'
          options={{
            title: 'Update Language Preferences',
          }}
        />
        <Stack.Screen
          name='song-history'
          options={{
            headerShown: false,
            title: 'Your Listening History',
          }}
        />
        <Stack.Screen
          name='qr-scanner'
          options={{
            headerShown: false,
            title: 'QR Scanner',
          }}
        />
        <Stack.Screen
          name='oauthredirect'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='[...unmatched]'
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name='edit-profile'
          options={{
            title: 'Edit Profile',
          }}
        />
        <Stack.Screen
          name='update-profile-picture'
          options={{
            title: 'Profile Picture',
          }}
        />
      </Stack>
      <Player />
      <AppUpdateModal />
    </>
  );
}

export default ObserveRoot.wrap(RootLayout);
