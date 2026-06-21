import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TrackPlayer from 'react-native-track-player';
import ErrorBoundary from '@/components/ErrorBoundary';
import Player from '@/components/music/Player';
import PlayerInitializer from '@/components/music/PlayerInitializer';
import CallScreen from '@/components/video/CallScreen';
import IncomingCallModal from '@/components/video/IncomingCall';
import { GroupMusicProvider } from '@/context/GroupMusicContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ChatProvider } from '@/context/SocketContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { UserProvider } from '@/context/UserContext';
import { AppUpdateProvider } from '@/context/AppUpdateContext';
import { useVideoCall, VideoCallProvider } from '@/context/VideoCallContext';
import '../global.css';
import { PlaybackService } from '../service';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TrackPlayer.registerPlaybackService(() => PlaybackService);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      gcTime: Infinity,
      staleTime: Infinity,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
});

function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AppUpdateProvider>
            <UserProvider>
              <PersistQueryClientProvider
                client={queryClient}
                persistOptions={{ persister: asyncStoragePersister }}
              >
                <ChatProvider>
                  <VideoCallProvider>
                    <NotificationProvider>
                      <GroupMusicProvider>
                        <GestureHandlerRootView style={{ flex: 1 }}>
                          <PlayerInitializer />
                          <RootLayoutNav />
                        </GestureHandlerRootView>
                      </GroupMusicProvider>
                    </NotificationProvider>
                  </VideoCallProvider>
                </ChatProvider>
              </PersistQueryClientProvider>
            </UserProvider>
          </AppUpdateProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const { colors, theme } = useTheme();
  const { incomingCall, isInCall } = useVideoCall();

  return (
    <>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
        showHideTransition='none'
      />
      <Stack
        screenOptions={{
          animation: 'none',
          presentation: 'card',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerShadowVisible: false,
          headerBackVisible: true,
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
            navigationBarColor: colors.background,
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
          }}
        />
        <Stack.Screen
          name='playlists'
          options={{
            navigationBarColor: colors.background,
            title: 'Playlist',
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
            navigationBarColor: colors.background,
            title: 'Album',
          }}
        />
        <Stack.Screen
          name='artist'
          options={{
            navigationBarColor: colors.background,
            title: 'Artist',
          }}
        />
        <Stack.Screen
          name='user-playlist'
          options={{
            navigationBarColor: colors.background,
            title: 'User Playlist',
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
      {incomingCall && <IncomingCallModal />}
      {!incomingCall && isInCall && <CallScreen />}
      <Player />
    </>
  );
}

export default RootLayout;
