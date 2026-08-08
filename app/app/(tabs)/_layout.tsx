import { TAB_BAR_HEIGHT, UnifiedBottomDeck } from "@/components/music/UnifiedBottomDeck"
import { useTheme } from "@/context/ThemeContext"
import { Tabs, useSegments } from "expo-router"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export { TAB_BAR_HEIGHT }

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const segments = useSegments()
  const { colors, theme } = useTheme()

  const activeSegment = (segments[1] ?? "home") as string

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Tabs
        tabBar={() => null}
        screenOptions={{
          headerShown: false,
          lazy: true,
          // The custom deck drives tab changes, so avoid an extra native
          // transition. Safe-area insets are provided synchronously at the
          // app root, so inactive scene detaching no longer causes a jump.
          animation: "none",
          freezeOnBlur: true,
          sceneStyle: { backgroundColor: colors.background },
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="home/index" options={{ title: "Home" }} />
        <Tabs.Screen name="group-music/index" options={{ title: "Group Music" }} />
        <Tabs.Screen name="playlist/index" options={{ title: "Playlist" }} />
        <Tabs.Screen name="chat/index" options={{ title: "Message" }} />
        <Tabs.Screen name="profile/index" options={{ title: "Profile" }} />
      </Tabs>

      <UnifiedBottomDeck colors={colors} theme={theme} insets={insets} activeSegment={activeSegment} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
})
