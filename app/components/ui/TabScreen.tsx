import { useFocusEffect } from "expo-router"
import { useCallback } from "react"
import { StyleSheet } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

/**
 * Wraps a tab screen's content with a fade-in on each focus.
 * Use this as the root view inside any tab screen to get smooth
 * transitions when switching tabs.
 */
export default function TabScreen({ children }: { children: React.ReactNode }) {
  const opacity = useSharedValue(0)

  useFocusEffect(
    useCallback(() => {
      opacity.value = withTiming(1, { duration: 200 })
      return () => {
        opacity.value = 0
      }
    }, [opacity]),
  )

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, flex: 1 }))

  return <Animated.View style={[styles.root, style]}>{children}</Animated.View>
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
