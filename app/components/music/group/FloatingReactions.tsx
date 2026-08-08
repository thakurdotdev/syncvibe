import React, { useEffect, useRef } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useGroupSessionStore } from "@/stores/groupMusic/groupSessionStore"

const FloatingEmoji = React.memo(
  ({
    emoji,
    userName,
  }: {
    emoji: string
    userName: string
  }) => {
    const seed = useRef({
      left: 15 + Math.random() * 70,
      sway: (Math.random() - 0.5) * 36,
      rotation: `${((Math.random() - 0.5) * 20).toFixed(1)}deg`,
    }).current

    const translateY = useSharedValue(0)
    const translateX = useSharedValue(0)
    const scale = useSharedValue(0)
    const opacity = useSharedValue(1)

    useEffect(() => {
      // Instant crisp spring pop
      scale.value = withSpring(1, { damping: 12, stiffness: 280, mass: 0.4 })

      // Balanced 800ms upward rise
      translateY.value = withTiming(-180, {
        duration: 800,
        easing: Easing.out(Easing.quad),
      })

      // Natural organic sway
      translateX.value = withTiming(seed.sway, {
        duration: 800,
        easing: Easing.out(Easing.quad),
      })

      // Smooth fade out near top of flight
      opacity.value = withDelay(
        550,
        withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) })
      )
    }, [seed.sway, scale, translateY, translateX, opacity])

    const rotationStr = seed.rotation

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { scale: scale.value },
        { rotate: rotationStr },
      ],
      opacity: opacity.value,
    }))

    return (
      <Animated.View
        style={[
          styles.floatingEmoji,
          { left: `${seed.left}%` },
          animatedStyle,
        ]}
      >
        <Text style={styles.emojiText}>{emoji}</Text>
        {userName ? (
          <Text style={styles.nameText} numberOfLines={1}>
            {userName}
          </Text>
        ) : null}
      </Animated.View>
    )
  }
)

FloatingEmoji.displayName = "FloatingEmoji"

export const FloatingReactions: React.FC = () => {
  const reactions = useGroupSessionStore((s) => s.floatingReactions)

  if (reactions.length === 0) return null

  return (
    <View style={styles.container} pointerEvents="none">
      {reactions.map((r) => (
        <FloatingEmoji
          key={r.id}
          emoji={r.emoji}
          userName={r.userName}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 99,
  },
  floatingEmoji: {
    position: "absolute",
    bottom: 110,
    alignItems: "center",
  },
  emojiText: {
    fontSize: 36,
    lineHeight: 42,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  nameText: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 1,
    maxWidth: 80,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
})
