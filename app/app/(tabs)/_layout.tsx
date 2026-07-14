import { useTheme } from "@/context/ThemeContext"
import { router, Tabs, useSegments } from "expo-router"
import { Home, ListMusic, LucideProps, MessageCircle, Music, User } from "lucide-react-native"
import React, { memo, useCallback, useEffect, useRef } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
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
  const dotOpacity = useSharedValue(isFocused ? 1 : 0)

  // Animate dot when focus changes
  useEffect(() => {
    dotOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 })
  }, [isFocused, dotOpacity])

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }))
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 15, stiffness: 400 })
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
          size={22}
          color={isFocused ? activeColor : inactiveColor}
          strokeWidth={isFocused ? 2.5 : 1.8}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: isFocused ? activeColor : inactiveColor },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {/* Small dot indicator below label */}
        <Animated.View
          style={[styles.dot, { backgroundColor: activeColor }, dotStyle]}
        />
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
          // Pre-render all screens upfront — eliminates flicker on first tab visit.
          // Tradeoff: slightly heavier app start, but all 5 screens are lightweight nav shells.
          lazy: false,
          sceneStyle: { backgroundColor: "transparent" },
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
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.1,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
})
