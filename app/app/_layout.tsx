import AppUpdateModal from '@/components/AppUpdateModal';
import ErrorBoundary from '@/components/ErrorBoundary';
import Player from '@/components/music/Player';
import GlobalBottomDeck from '@/components/shell/GlobalBottomDeck';
import TopIsland from '@/components/shell/TopIsland';
import { deckBlurTarget } from '@/components/shell/GlassSurface';
import { BlurTargetView } from 'expo-blur';
import PlayerInitializer from '@/components/music/PlayerInitializer';
import { RoomSongSheet } from '@/components/music/room/RoomSongSheet';
import { GroupMusicProvider } from '@/context/GroupMusicContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ChatProvider } from '@/context/SocketContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { typography } from '@/theme/typography';
import { ToastProvider } from '@/context/ToastContext';
import { UserProvider, useUser } from '@/context/UserContext';
import { useAuthGate } from '@/hooks/useAuthGate';
import { captureFatalJsErrors, sendCrashReports } from '@/lib/crashReports';
import { onboardingCheckAtLaunch } from '@/lib/onboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TrackPlayer from '@rntp/player';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { defaultShouldDehydrateQuery, QueryClient, useIsRestoring } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as Notifications from 'expo-notifications';
import { NotificationBehavior } from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { Stack } from 'expo-router';
import { ObserveRoot, useObserve } from 'expo-observe';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';
import '../global.css';

// First, so a crash anywhere after this leaves its reason for the next launch.
captureFatalJsErrors();
SplashScreen.preventAutoHideAsync();
// Started before the first render, so it is usually done by the time anything asks.
void onboardingCheckAtLaunch();

/** The splash never waits longer than this, whatever is still loading. */
const SPLASH_MAX_MS = 2500;

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

Notifications.setNotificationHandler({
  handleNotification: async (notification): Promise<NotificationBehavior> => {
    const { title, body, data } = notification.request.content;
    // A data-only push carries a message for the app to draw itself (lib/messageNotifications).
    // A message push while the app is open is a duplicate: the socket brings the same message,
    // which the in-app banner shows.
    const show = Boolean(title || body) && data?.type !== 'message';
    return {
      shouldShowBanner: show,
      shouldShowAlert: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    };
  },
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

/**
 * Queries worth keeping between launches: what a screen shows the moment it opens. The saved
 * cache is read before the first screen and rewritten while you use the app, so search results
 * and recommendation lists (one entry per keystroke or song) stay in memory only.
 */
const PERSISTED_QUERIES = new Set([
  'homePageMusic',
  'station',
  'recentMusic',
  'musicHistory',
  'playlistDetails',
  'albumDetails',
  'artistDetails',
]);

const persistOptions = {
  persister: asyncStoragePersister,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: Parameters<typeof defaultShouldDehydrateQuery>[0]) =>
      defaultShouldDehydrateQuery(query) && PERSISTED_QUERIES.has(String(query.queryKey[0])),
  },
};

function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1 }}>
          {/* Real keyboard position on the UI thread (edge-to-edge Android doesn't resize). */}
          <KeyboardProvider>
            <ThemeProvider>
              <ToastProvider>
                <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
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
              </ToastProvider>
            </ThemeProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

function RootLayoutNav() {
  const { colors, theme, isLoading: themeLoading } = useTheme();
  const { markInteractive } = useObserve();
  useAuthGate();
  // Everything the first screen reads from this phone. Waiting for it behind the splash means the
  // first frame is the finished screen: no blank frame, no avatar or saved music popping in.
  const { restored: userRestored, user } = useUser();
  const signedIn = Boolean(user?.userid);
  const queriesRestoring = useIsRestoring();
  const [onboardingKnown, setOnboardingKnown] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    void onboardingCheckAtLaunch().then(() => setOnboardingKnown(true));
  }, []);

  // How the app last closed, if it wasn't asked to (lib/crashReports). Sent once, signed in.
  useEffect(() => {
    if (signedIn) void sendCrashReports();
  }, [signedIn]);

  const ready = timedOut || (!themeLoading && onboardingKnown && userRestored && !queriesRestoring);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setTimedOut(true), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    // One frame later, so the screen under the splash has been drawn.
    const frame = requestAnimationFrame(() => {
      SplashScreen.hideAsync();
      markInteractive();
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, markInteractive]);

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
      {/* The floating bottom bar blurs these screens (and only these) on Android. */}
      <BlurTargetView ref={deckBlurTarget} style={styles.blurTarget}>
        <Stack
          screenOptions={{
            animation: 'default',
            gestureEnabled: false,
            // A screen under another one stops re-rendering (the player ticks, sockets, queries)
            // until you come back to it, so the screen you're on has the JS thread to itself.
            freezeOnBlur: true,
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
            name='onboarding'
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name='sign-in'
            options={{
              headerShown: false,
              gestureEnabled: false,
              animation: 'fade',
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
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name='browse'
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
            name='liked'
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name='recap'
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name='blend'
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name='starred'
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen
            name='music-taste'
            options={{
              headerShown: false,
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
            name='appearance'
            options={{
              headerShown: false,
              title: 'Appearance',
            }}
          />
          <Stack.Screen
            name='security'
            options={{
              headerShown: false,
              title: 'Security',
            }}
          />
          <Stack.Screen
            name='update-profile-picture'
            options={{
              title: 'Profile Picture',
            }}
          />
        </Stack>
      </BlurTargetView>
      <GlobalBottomDeck />
      <Player />
      <RoomSongSheet />
      <AppUpdateModal />
      {/* Last, so moments show over the player and the bottom bar. */}
      <TopIsland />
    </>
  );
}

export default ObserveRoot.wrap(RootLayout);

const styles = StyleSheet.create({
  blurTarget: { flex: 1 },
});
