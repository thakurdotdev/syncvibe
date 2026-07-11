import { useTheme } from "@/context/ThemeContext"
import { router, Tabs, useSegments } from "expo-router"
import { Home, ListMusic, LucideProps, MessageCircle, Music, User } from "lucide-react-native"
import React, { memo, useCallback } from "react"
import { Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type TabBarProps = {
  colors: ReturnType<typeof useTheme>["colors"]
  insets: ReturnType<typeof useSafeAreaInsets>
  activeSegment: string
}

type TabButtonProps = {
  isFocused: boolean
  onPress: () => void
  label: string
  icon: React.ComponentType<LucideProps>
  activeColor: string
  inactiveColor: string
}

const TabButton = memo(function TabButton({
  isFocused,
  onPress,
  label,
  icon: Icon,
  activeColor,
  inactiveColor,
}: TabButtonProps) {
  const color = isFocused ? activeColor : inactiveColor

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12 }}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          paddingVertical: 4,
        }}
      >
        <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 1.8} />
        <Text
          style={{
            color,
            fontWeight: isFocused ? "600" : "400",
            marginTop: 6,
            fontSize: 12,
          }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
})

const CustomTabBar = memo(function CustomTabBar({ colors, insets, activeSegment }: TabBarProps) {
  const activeColor = colors.primary
  const inactiveColor = colors.mutedForeground

  const goHome = useCallback(() => router.navigate("/home"), [])
  const goGroup = useCallback(() => router.navigate("/group-music"), [])
  const goPlaylist = useCallback(() => router.navigate("/playlist"), [])
  const goChat = useCallback(() => router.navigate("/chat"), [])
  const goProfile = useCallback(() => router.navigate("/profile"), [])

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: 75 + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        zIndex: 1000,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        flexDirection: "row",
      }}
    >
      <TabButton
        onPress={goHome}
        label="Home"
        icon={Home}
        isFocused={activeSegment === "home"}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
      />
      <TabButton
        onPress={goGroup}
        label="Group"
        icon={Music}
        isFocused={activeSegment === "group-music"}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
      />
      <TabButton
        onPress={goPlaylist}
        label="Playlist"
        icon={ListMusic}
        isFocused={activeSegment === "playlist"}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
      />
      <TabButton
        onPress={goChat}
        label="Chat"
        icon={MessageCircle}
        isFocused={activeSegment === "chat"}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
      />
      <TabButton
        onPress={goProfile}
        label="Profile"
        icon={User}
        isFocused={activeSegment === "profile"}
        activeColor={activeColor}
        inactiveColor={inactiveColor}
      />
    </View>
  )
})

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const segments = useSegments()
  const { colors } = useTheme()

  // segments[1] is the tab segment name e.g. 'home', 'chat', etc.
  const activeSegment = segments[1] ?? "home"

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: "none",
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
