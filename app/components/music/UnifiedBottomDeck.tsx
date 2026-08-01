import { useTheme } from "@/context/ThemeContext"
import { router } from "expo-router"
import * as Haptics from "expo-haptics"
import { BlurView } from "expo-blur"
import { Ionicons } from "@expo/vector-icons"
import { useProgress } from "@rntp/player"
import React, { memo, useCallback, useEffect, useMemo } from "react"
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  usePlaybackState,
  usePlayerControls,
  openFullPlayer,
} from "@/stores/playerStore"

export const TAB_BAR_HEIGHT = 110

const TAB_ITEMS = [
  {
    name: "home",
    label: "Home",
    activeIcon: "home",
    inactiveIcon: "home-outline",
  },
  {
    name: "group-music",
    label: "Group",
    activeIcon: "headset",
    inactiveIcon: "headset-outline",
  },
  {
    name: "playlist",
    label: "Playlist",
    activeIcon: "musical-notes",
    inactiveIcon: "musical-notes-outline",
  },
  {
    name: "chat",
    label: "Chat",
    activeIcon: "chatbubble-ellipses",
    inactiveIcon: "chatbubble-ellipses-outline",
  },
  {
    name: "profile",
    label: "Profile",
    activeIcon: "person-circle",
    inactiveIcon: "person-circle-outline",
  },
] as const

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 320,
  mass: 0.5,
}

const MiniProgressBar = memo(function MiniProgressBar({ color }: { color: string }) {
  const { position, duration } = useProgress()
  const progressPercent = duration > 0 ? (position / duration) * 100 : 0
  const clampedPercent = Math.min(100, Math.max(0, progressPercent))

  return (
    <View style={styles.progressBarTrack}>
      <View
        style={[
          styles.progressBarFill,
          {
            width: `${clampedPercent}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  )
})

type TabButtonProps = {
  isFocused: boolean
  onPress: () => void
  label: string
  activeIcon: keyof typeof Ionicons.glyphMap
  inactiveIcon: keyof typeof Ionicons.glyphMap
  activeColor: string
  inactiveColor: string
}

const TabButton = memo(function TabButton({
  isFocused,
  onPress,
  label,
  activeIcon,
  inactiveIcon,
  activeColor,
  inactiveColor,
}: TabButtonProps) {
  const scale = useSharedValue(1)
  const focusAnim = useSharedValue(isFocused ? 1 : 0)

  useEffect(() => {
    focusAnim.value = withSpring(isFocused ? 1 : 0, SPRING_CONFIG)
  }, [isFocused, focusAnim])

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: focusAnim.value > 0.05 ? activeColor + "18" : "transparent",
    paddingHorizontal: interpolate(focusAnim.value, [0, 1], [8, 14], Extrapolation.CLAMP),
  }))

  const labelWrapperStyle = useAnimatedStyle(() => ({
    opacity: focusAnim.value,
    maxWidth: interpolate(focusAnim.value, [0, 1], [0, 76], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(focusAnim.value, [0, 1], [-4, 0], Extrapolation.CLAMP) },
    ],
  }))

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 400 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 350 })
      }}
      style={styles.tabButton}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabPillContainer, pillStyle]}>
        <View style={{ opacity: isFocused ? 1 : 0.68 }}>
          <Ionicons
            name={isFocused ? activeIcon : inactiveIcon}
            size={21}
            color={isFocused ? activeColor : inactiveColor}
          />
        </View>
        <Animated.View style={[styles.labelWrapper, labelWrapperStyle]}>
          <Animated.Text
            style={[
              styles.tabLabel,
              {
                color: activeColor,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
})

type MiniPlayerRowProps = {
  currentSong: any
  isPlaying: boolean
  handlePlayPause: () => void
  handleNextSong: () => void
  colors: ReturnType<typeof useTheme>["colors"]
  isDark: boolean
}

export const MiniPlayerRow = memo(function MiniPlayerRow({
  currentSong,
  isPlaying,
  handlePlayPause,
  handleNextSong,
  colors,
  isDark,
}: MiniPlayerRowProps) {
  const pressScale = useSharedValue(1)

  const artistName = useMemo(
    () =>
      currentSong?.artist_map?.artists
        ?.slice(0, 3)
        ?.map((a: any) => a.name)
        .join(", ") || "Unknown Artist",
    [currentSong],
  )

  const artworkUri = currentSong?.image?.[2]?.link || currentSong?.image?.[1]?.link

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))

  const handleOpenPlayer = () => {
    openFullPlayer()
  }

  const artworkBorderColor = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"

  return (
    <View style={styles.miniPlayerWrapper}>
      {/* Precision Mini Progress Bar */}
      <MiniProgressBar color={colors.primary} />

      <Animated.View style={[styles.miniPlayerRowContainer, rowAnimatedStyle]}>
        <Pressable
          style={styles.miniPlayerPressable}
          onPress={handleOpenPlayer}
          onPressIn={() => {
            pressScale.value = withTiming(0.98, { duration: 80 })
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, { damping: 15, stiffness: 350 })
          }}
        >
          {/* 48px Artwork */}
          <View style={[styles.artworkContainer, { borderColor: artworkBorderColor }]}>
            <Image source={{ uri: artworkUri }} style={styles.miniPlayerArtwork} />
          </View>

          {/* Song Info */}
          <View style={styles.songInfoContainer}>
            <Text style={[styles.songTitleText, { color: colors.foreground }]} numberOfLines={1}>
              {currentSong?.name}
            </Text>
            <Text
              style={[styles.artistNameText, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {artistName}
            </Text>
          </View>

          {/* Playback Controls */}
          <View style={styles.controlsRow}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation()
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                handlePlayPause()
              }}
              style={[styles.dominantPlayButton, { backgroundColor: colors.primary + "18" }]}
              hitSlop={6}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color={colors.primary}
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation()
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                handleNextSong()
              }}
              style={styles.secondaryNextButton}
              hitSlop={8}
            >
              <Ionicons name="play-skip-forward" size={17} color={colors.foreground} />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
})

type UnifiedBottomDeckProps = {
  colors: ReturnType<typeof useTheme>["colors"]
  theme: string
  insets: ReturnType<typeof useSafeAreaInsets>
  activeSegment: string
}

export const UnifiedBottomDeck = memo(function UnifiedBottomDeck({
  colors,
  theme,
  insets,
  activeSegment,
}: UnifiedBottomDeckProps) {
  const { currentSong, isPlaying } = usePlaybackState()
  const { handlePlayPause, handleNextSong } = usePlayerControls()

  const goHome = useCallback(() => router.navigate("/home"), [])
  const goGroup = useCallback(() => router.navigate("/group-music"), [])
  const goPlaylist = useCallback(() => router.navigate("/playlist"), [])
  const goChat = useCallback(() => router.navigate("/chat"), [])
  const goProfile = useCallback(() => router.navigate("/profile"), [])
  const handlers = [goHome, goGroup, goPlaylist, goChat, goProfile]

  const isDark = theme === "dark"

  const surfaceBgColor = isDark ? "rgba(24, 24, 28, 0.90)" : "rgba(255, 255, 255, 0.92)"
  const surfaceBorderColor = isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
  const dividerColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)"

  const showMiniPlayer = !!currentSong

  return (
    <View
      style={[
        styles.unifiedSurfaceOuter,
        {
          bottom: Math.max(10, insets.bottom),
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === "android" ? 40 : 75}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.unifiedSurfaceContainer,
          {
            backgroundColor: surfaceBgColor,
            borderColor: surfaceBorderColor,
          },
        ]}
      >
        {/* Top Section: Mini Player */}
        {showMiniPlayer && (
          <>
            <MiniPlayerRow
              currentSong={currentSong}
              isPlaying={isPlaying}
              handlePlayPause={handlePlayPause}
              handleNextSong={handleNextSong}
              colors={colors}
              isDark={isDark}
            />
            {/* Low Opacity Hairline Divider */}
            <View style={[styles.hairlineDivider, { backgroundColor: dividerColor }]} />
          </>
        )}

        {/* Bottom Section: Navigation Bar */}
        <View style={styles.navigationSectionRow}>
          {TAB_ITEMS.map((tab, index) => (
            <TabButton
              key={tab.name}
              onPress={handlers[index]}
              label={tab.label}
              activeIcon={tab.activeIcon}
              inactiveIcon={tab.inactiveIcon}
              isFocused={activeSegment === tab.name}
              activeColor={colors.primary}
              inactiveColor={colors.mutedForeground}
            />
          ))}
        </View>
      </BlurView>
    </View>
  )
})

const styles = StyleSheet.create({
  unifiedSurfaceOuter: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  unifiedSurfaceContainer: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: "hidden",

    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },

  // Progress Bar Styles
  progressBarTrack: {
    width: "100%",
    height: 3,
    backgroundColor: "rgba(128, 128, 128, 0.35)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },

  // Mini Player Styles
  miniPlayerWrapper: {
    width: "100%",
  },
  miniPlayerRowContainer: {
    width: "100%",
  },
  miniPlayerPressable: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: "100%",
  },
  artworkContainer: {
    borderRadius: 11,
    borderWidth: 1,
    overflow: "hidden",
  },
  miniPlayerArtwork: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  songInfoContainer: {
    flex: 1,
    paddingLeft: 12,
    paddingRight: 6,
    justifyContent: "center",
  },
  songTitleText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  artistNameText: {
    fontSize: 12,
    opacity: 0.72,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  dominantPlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryNextButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  // Divider Styles
  hairlineDivider: {
    height: 1,
    marginHorizontal: 12,
  },

  // Navigation Styles
  navigationSectionRow: {
    flexDirection: "row",
    height: 48,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    flex: 1,
  },
  tabPillContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
  },
  labelWrapper: {
    overflow: "hidden",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 5,
    letterSpacing: 0.1,
  },
})
