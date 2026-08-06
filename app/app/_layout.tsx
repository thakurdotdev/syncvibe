import AsyncStorage from "@react-native-async-storage/async-storage"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import * as Notifications from "expo-notifications"
import { Stack } from "expo-router/js-stack"
import { Easing } from "react-native-reanimated"
import * as SplashScreen from "expo-splash-screen"
import { useEffect } from "react"
import { StatusBar } from "react-native"
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import TrackPlayer from "@rntp/player"
import ErrorBoundary from "@/components/ErrorBoundary"
import Player from "@/components/music/Player"
import PlayerInitializer from "@/components/music/PlayerInitializer"
import { GroupMusicProvider } from "@/context/GroupMusicContext"
import { NotificationProvider } from "@/context/NotificationContext"
import { ChatProvider } from "@/context/SocketContext"
import { ThemeProvider, useTheme } from "@/context/ThemeContext"
import { ToastProvider } from "@/context/ToastContext"
import { UserProvider, useUser } from "@/context/UserContext"
import { AppUpdateProvider } from "@/context/AppUpdateContext"
import AppUpdateModal from "@/components/AppUpdateModal"
import "../global.css"
import { NotificationBehavior } from "expo-notifications"

SplashScreen.preventAutoHideAsync()

configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
})

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowAlert: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

TrackPlayer.registerBackgroundEventHandler(() => async (event) => {
  const { handleBackgroundPlaybackEvent } = await import("../service")
  await handleBackgroundPlaybackEvent(event)
})

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
})

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
})

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
                  <NotificationProvider>
                    <GroupMusicProvider>
                      <GestureHandlerRootView style={{ flex: 1 }}>
                        <PlayerInitializer />
                        <RootLayoutNav />
                      </GestureHandlerRootView>
                    </GroupMusicProvider>
                  </NotificationProvider>
                </ChatProvider>
              </PersistQueryClientProvider>
            </UserProvider>
          </AppUpdateProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

function RootLayoutNav() {
  const { colors, theme, isLoading: themeLoading } = useTheme()
  const { loading: userLoading } = useUser()

  useEffect(() => {
    if (!themeLoading && !userLoading) {
      SplashScreen.hideAsync()
    }
  }, [themeLoading, userLoading])

  const sharedAxisZ = ({ current, next }: any) => {
    const progress = current.progress
    const nextProgress = next?.progress

    const cardStyle = {
      opacity: progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.6, 1],
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.94, 1],
          }),
        },
      ],
    }

    const overlayStyle = nextProgress
      ? {
          opacity: nextProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.3],
          }),
        }
      : undefined

    return { cardStyle, overlayStyle }
  }

  const transitionSpec = {
    open: {
      animation: "timing" as const,
      config: { duration: 220, easing: Easing.out(Easing.cubic) },
    },
    close: {
      animation: "timing" as const,
      config: { duration: 180, easing: Easing.in(Easing.cubic) },
    },
  }

  return (
    <>
      <StatusBar
        barStyle={theme === "dark" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />
      <Stack
        screenOptions={{
          cardStyleInterpolator: sharedAxisZ,
          transitionSpec,
          cardOverlayEnabled: true,
          gestureEnabled: false,
          headerStyle: {
            backgroundColor: colors.background,
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: "600",
            fontSize: 18,
          },
          cardStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: "Login",
            presentation: "modal",
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="playlists"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="search"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="albums"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="artist"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="user-playlist"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="message"
          options={{
            headerShown: false,
            title: "Message",
          }}
        />
        <Stack.Screen
          name="music-language"
          options={{
            title: "Update Language Preferences",
          }}
        />
        <Stack.Screen
          name="song-history"
          options={{
            headerShown: false,
            title: "Your Listening History",
          }}
        />
        <Stack.Screen
          name="qr-scanner"
          options={{
            headerShown: false,
            title: "QR Scanner",
          }}
        />
        <Stack.Screen
          name="oauthredirect"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="[...unmatched]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{
            title: "Edit Profile",
          }}
        />
        <Stack.Screen
          name="update-profile-picture"
          options={{
            title: "Profile Picture",
          }}
        />
      </Stack>
      <Player />
      <AppUpdateModal />
    </>
  )
}

export default RootLayout
