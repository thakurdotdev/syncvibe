import React, { useCallback, useRef } from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { useTheme } from "@/context/ThemeContext"
import { useGroupMusic } from "@/context/GroupMusicContext"

const REACTIONS = ["🔥", "❤️", "👏", "😍", "🎵"]
const COOLDOWN_MS = 500

export const ReactionBar: React.FC = () => {
  const { colors } = useTheme()
  const { sendReaction } = useGroupMusic()
  const lastReactionTime = useRef(0)

  const handleReaction = useCallback(
    (emoji: string) => {
      const now = Date.now()
      if (now - lastReactionTime.current < COOLDOWN_MS) return
      lastReactionTime.current = now
      sendReaction(emoji)
    },
    [sendReaction],
  )

  return (
    <View style={styles.container}>
      {REACTIONS.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          onPress={() => handleReaction(emoji)}
          activeOpacity={0.6}
          style={[styles.reactionButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  reactionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 20,
  },
})
