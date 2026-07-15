import { useTheme } from "@/context/ThemeContext"
import { router, Tabs, useSegments } from "expo-router"
import { Home, ListMusic, LucideProps, MessageCircle, Music, User } from "lucide-react-native"
import React, { memo, useCallback } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export const TAB_BAR_HEIGHT = 60

const TAB_ITEMS = [
  { name: "home", label: "Home", Icon: Home, route: "/home" },
  { name: "group-music", label: "Group", Icon: Music, route: "/group-music" },
  { name: "playlist", label: "Playlist", Icon: ListMusic, route: "/playlist" },
  { name: "chat", label: "Chat", Icon: MessageCircle, route: "/chat" },
  { name: "profile", label: "Profile", Icon: User, route: "/profile" },
] as const

type TabButtonProps = {
  isFocused: boolean
  onPress: () => void
  label: string
  Icon: React.ComponentType<LucideProps>
  activeColor: string
  inactiveColor: string
}

const TabButton = memo(function TabButton({
  isFocused,
  onPress,
  label,
  Icon,
  activeColor,
  inactiveColor,
}: TabButtonProps) {
  const scale = useSharedValue(1)
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.88, { damping: 15, stiffness: 400 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 350 })
      }}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabButtonInner, scaleStyle]}>
        <Icon
          size={23}
          color={isFocused ? activeColor : inactiveColor}
          strokeWidth={isFocused ? 2.5 : 1.6}
        />
        <Text
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : inactiveColor,
              fontWeight: isFocused ? "600" : "400",
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
})

type CustomTabBarProps = {
  colors: ReturnType<typeof useTheme>["colors"]
  insets: ReturnType<typeof useSafeAreaInsets>
  activeSegment: string
}

const CustomTabBar = memo(function CustomTabBar({
  colors,
  insets,
  activeSegment,
}: CustomTabBarProps) {
  const goHome = useCallback(() => router.navigate("/home"), [])
  const goGroup = useCallback(() => router.navigate("/group-music"), [])
  const goPlaylist = useCallback(() => router.navigate("/playlist"), [])
  const goChat = useCallback(() => router.navigate("/chat"), [])
  const goProfile = useCallback(() => router.navigate("/profile"), [])
  const handlers = [goHome, goGroup, goPlaylist, goChat, goProfile]

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      ]}
    >
      {TAB_ITEMS.map((tab, index) => (
        <TabButton
          key={tab.name}
          onPress={handlers[index]}
          label={tab.label}
          Icon={tab.Icon}
          isFocused={activeSegment === tab.name}
          activeColor={colors.primary}
          inactiveColor={colors.mutedForeground}
        />
      ))}
    </View>
  )
})

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const segments = useSegments()
  const { colors } = useTheme()

  const activeSegment = (segments[1] ?? "home") as string

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          lazy: false,
          sceneStyle: { backgroundColor: colors.background },
        }}
        tabBar={() => null}
      >
        <Tabs.Screen name="home/index" options={{ title: "Home" }} />
        <Tabs.Screen name="group-music/index" options={{ title: "Group Music" }} />
        <Tabs.Screen name="playlist/index" options={{ title: "Playlist" }} />
        <Tabs.Screen name="chat/index" options={{ title: "Message" }} />
        <Tabs.Screen name="profile/index" options={{ title: "Profile" }} />
      </Tabs>

      <CustomTabBar colors={colors} insets={insets} activeSegment={activeSegment} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    zIndex: 1000,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
})
