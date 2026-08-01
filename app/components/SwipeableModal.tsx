import React, { useEffect, useCallback, useState } from "react"
import {
  Dimensions,
  Modal,
  StyleSheet,
  View,
  ViewStyle,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
} from "react-native"
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler"
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useTheme } from "@/context/ThemeContext"

const { height: SCREEN_HEIGHT } = Dimensions.get("window")
const DISMISS_VELOCITY = 500

interface SwipeableModalProps {
  isVisible: boolean
  onClose: () => void
  children: React.ReactNode
  maxHeight?: number | "auto" | `${number}%`
  hideHandle?: boolean
  backdropOpacity?: number
  style?: ViewStyle
  scrollable?: boolean
  useScrollView?: boolean
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
}

const SwipeableModal: React.FC<SwipeableModalProps> = ({
  isVisible,
  onClose,
  children,
  maxHeight = SCREEN_HEIGHT * 0.8,
  hideHandle = false,
  backdropOpacity = 0.6,
  style,
  scrollable = false,
  useScrollView = false,
  onScroll,
}) => {
  const { colors } = useTheme()
  // Modal must stay mounted until close animation finishes
  const [modalMounted, setModalMounted] = useState(false)

  const progress = useSharedValue(0)
  const gestureY = useSharedValue(0)

  const animateOpen = useCallback(() => {
    gestureY.value = 0
    progress.value = withSpring(1, { damping: 24, stiffness: 220, mass: 0.8 })
  }, [progress, gestureY])

  const animateClose = useCallback(
    (callback?: () => void) => {
      progress.value = withTiming(0, { duration: 220 }, (finished) => {
        "worklet"
        if (finished) {
          scheduleOnRN(callback ?? onClose)
          gestureY.value = 0
        }
      })
    },
    [progress, gestureY, onClose],
  )

  // Drive mount/unmount around the animation
  useEffect(() => {
    if (isVisible) {
      setModalMounted(true)
      // Small delay so Modal renders before we animate in
      requestAnimationFrame(() => animateOpen())
    } else if (modalMounted) {
      animateClose(() => {
        setModalMounted(false)
        onClose()
      })
    }
  }, [isVisible]) // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedMaxHeight = typeof maxHeight === "number" ? maxHeight : SCREEN_HEIGHT * 0.8

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      "worklet"
      if (e.translationY > 0) {
        gestureY.value = e.translationY * 0.7
      }
    })
    .onEnd((e) => {
      "worklet"
      const shouldDismiss =
        e.translationY > resolvedMaxHeight * 0.3 || e.velocityY > DISMISS_VELOCITY

      if (shouldDismiss) {
        progress.value = withTiming(0, { duration: 220 }, (finished) => {
          "worklet"
          if (finished) {
            scheduleOnRN(onClose)
            gestureY.value = 0
          }
        })
      } else {
        gestureY.value = withSpring(0, { damping: 20, stiffness: 300 })
      }
    })

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, backdropOpacity], Extrapolation.CLAMP),
  }))

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          interpolate(progress.value, [0, 1], [SCREEN_HEIGHT, 0], Extrapolation.CLAMP) +
          gestureY.value,
      },
    ],
  }))

  if (!modalMounted) return null

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => animateClose()}
    >
      <GestureHandlerRootView style={styles.root}>
        {/* Tappable backdrop — fills space above sheet */}
        <Pressable style={styles.backdropTouchable} onPress={() => animateClose()} />

        {/* Animated dim layer — covers full screen, pointer events off */}
        <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents="none" />

        {/* Sheet with gesture */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                maxHeight,
              },
              sheetStyle,
              style,
            ]}
          >
            {!hideHandle && (
              <View style={styles.handleContainer}>
                <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
              </View>
            )}
            {scrollable && useScrollView ? (
              <ScrollView
                onScroll={onScroll}
                scrollEventThrottle={16}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    width: "100%",
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
})

export default React.memo(SwipeableModal)
