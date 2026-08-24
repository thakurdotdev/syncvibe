import React, { memo, useState, useEffect, useCallback, useMemo } from "react"
import { StyleSheet, Text, TouchableOpacity, View } from "react-native"
import { Feather, Ionicons } from "@expo/vector-icons"
import { useTheme } from "@/context/ThemeContext"
import { Message } from "@/stores/groupMusic/types"
import { soundEffectsManager } from "@/utils/soundEffectsManager"

// Generate a deterministic, realistic waveform pattern based on sound ID/name
const generateWaveform = (str = ""): number[] => {
  const bars: number[] = []
  let seed = 0
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) & 0xffffffff
  }
  for (let i = 0; i < 24; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    const norm = Math.abs(seed % 100) / 100
    // Height between 4 and 18 for voice-note waveform bars
    const h = Math.round(4 + norm * 14)
    bars.push(h)
  }
  return bars
}

interface SoundMessageRowProps {
  msg: Message
  isOwn: boolean
}

export const SoundMessageRow: React.FC<SoundMessageRowProps> = memo(({ msg, isOwn }) => {
  const { colors } = useTheme()
  const [isPlaying, setIsPlaying] = useState(false)

  const soundUrl = msg.soundUrl || msg.message
  const soundName = msg.soundName || msg.message || "Sound Effect"
  const soundId = msg.soundId || soundName

  const waveformBars = useMemo(() => generateWaveform(soundId), [soundId])

  const handleTogglePlay = useCallback(() => {
    if (!soundUrl) return

    if (isPlaying) {
      soundEffectsManager.stopPreview()
      setIsPlaying(false)
      return
    }

    setIsPlaying(true)
    soundEffectsManager.playPreview(
      soundUrl,
      () => setIsPlaying(false),
      () => setIsPlaying(false),
    )
  }, [isPlaying, soundUrl])

  useEffect(() => {
    return () => {
      if (isPlaying) {
        soundEffectsManager.stopPreview()
      }
    }
  }, [isPlaying])

  return (
    <View style={styles.container}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={handleTogglePlay}
        activeOpacity={0.8}
        style={[
          styles.playBtn,
          {
            backgroundColor: isOwn
              ? colors.primaryForeground
              : colors.primary,
          },
        ]}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={15}
          color={isOwn ? colors.primary : colors.primaryForeground}
          style={!isPlaying ? { marginLeft: 1.5 } : undefined}
        />
      </TouchableOpacity>

      {/* Waveform & Info */}
      <View style={styles.infoCol}>
        <Text
          style={[
            styles.titleText,
            { color: isOwn ? colors.primaryForeground : colors.foreground },
          ]}
          numberOfLines={1}
        >
          {soundName}
        </Text>

        {/* Waveform Bars */}
        <TouchableOpacity
          onPress={handleTogglePlay}
          activeOpacity={0.85}
          style={styles.waveformRow}
        >
          {waveformBars.map((height, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: isPlaying
                    ? isOwn
                      ? colors.primaryForeground
                      : colors.primary
                    : isOwn
                      ? colors.primaryForeground + "50"
                      : colors.foreground + "35",
                },
              ]}
            />
          ))}
        </TouchableOpacity>
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    width: 200,
    paddingVertical: 2,
    gap: 10,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  infoCol: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  titleText: {
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 16,
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 18,
    gap: 2,
  },
  bar: {
    width: 2.5,
    borderRadius: 2,
  },
})

export default SoundMessageRow
