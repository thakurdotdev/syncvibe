import React, { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from "react-native-reanimated"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"

const FloatingEmoji = ({
  emoji,
  userName,
  delay,
  horizontalOffset,
}: {
  emoji: string
  userName: string
  delay: number
  horizontalOffset: number
}) => {
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(1)
  const scale = useSharedValue(0.5)

  useEffect(() => {
    scale.value = withDelay(delay, withTiming(1, { duration: 200, easing: Easing.out(Easing.back(2)) }))
    translateY.value = withDelay(
      delay,
      withTiming(-180, { duration: 2500, easing: Easing.out(Easing.quad) }),
    )
    opacity.value = withDelay(delay + 1800, withTiming(0, { duration: 700 }))
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[styles.floatingEmoji, { left: horizontalOffset }, style]}>
      <Text style={styles.emojiText}>{emoji}</Text>
      <Text style={styles.nameText} numberOfLines={1}>
        {userName}
      </Text>
    </Animated.View>
  )
}

export const FloatingReactions: React.FC = () => {
  const reactions = useGroupSessionStore((s) => s.floatingReactions)

  if (reactions.length === 0) return null

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((r, i) => (
        <FloatingEmoji
          key={r.id}
          emoji={r.emoji}
          userName={r.userName}
          delay={i * 80}
          horizontalOffset={30 + Math.random() * 60}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    overflow: "hidden",
  },
  floatingEmoji: {
    position: "absolute",
    bottom: 100,
    alignItems: "center",
  },
  emojiText: {
    fontSize: 28,
  },
  nameText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600",
    marginTop: 2,
    maxWidth: 60,
    textAlign: "center",
  },
})
