import { AlertCircle, Check, CheckCircle, Info } from "lucide-react-native"
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Card } from "@/components/ui/card"
import { useTheme } from "./ThemeContext"

export type ToastType = "default" | "success" | "error" | "info"

interface ToastOptions {
  type?: ToastType
  duration?: number
}

type ToastFunction = (message: string, options?: ToastOptions) => void

let globalToast: ToastFunction | null = null

export const toast = (message: string, options?: ToastOptions) => {
  if (globalToast) {
    globalToast(message, options)
  } else {
    console.warn("Toast not initialized yet. Make sure ToastProvider is mounted.")
  }
}

interface ToastContextType {
  toast: ToastFunction
}

interface ToastProviderProps {
  children: ReactNode
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

const SPRING_CONFIG = { damping: 22, stiffness: 260 }

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [visible, setVisible] = useState<boolean>(false)
  const [message, setMessage] = useState<string>("")
  const [toastType, setToastType] = useState<ToastType>("default")

  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-60)
  const translateX = useSharedValue(0)
  const scale = useSharedValue(0.92)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getToastColor = useCallback(
    (type: ToastType) => {
      switch (type) {
        case "success":
          return colors.primary
        case "error":
          return colors.destructive
        case "info":
          return colors.accent
        default:
          return colors.primary
      }
    },
    [colors],
  )

  const getToastIcon = useCallback(
    (type: ToastType) => {
      const size = 18
      const color = getToastColor(type)

      switch (type) {
        case "success":
          return <CheckCircle size={size} color={color} strokeWidth={2.5} />
        case "error":
          return <AlertCircle size={size} color={color} strokeWidth={2.5} />
        case "info":
          return <Info size={size} color={color} strokeWidth={2.5} />
        default:
          return <Check size={size} color={color} strokeWidth={2.5} />
      }
    },
    [getToastColor],
  )

  const hideToast = useCallback(() => {
    opacity.value = withTiming(0, { duration: 180 }, (finished) => {
      "worklet"
      if (finished) {
        scheduleOnRN(setVisible, false)
      }
    })
    translateY.value = withTiming(-60, { duration: 180 })
    scale.value = withTiming(0.92, { duration: 180 })
  }, [opacity, translateY, scale])

  const showToast = useCallback(
    (msg: string, options?: ToastOptions) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      const type = options?.type || "default"
      const duration = options?.duration || 3000

      setMessage(msg)
      setToastType(type)
      setVisible(true)

      translateX.value = 0
      translateY.value = -60
      opacity.value = 0
      scale.value = 0.92

      opacity.value = withTiming(1, { duration: 200 })
      translateY.value = withSpring(0, SPRING_CONFIG)
      scale.value = withSpring(1, SPRING_CONFIG)

      timeoutRef.current = setTimeout(() => {
        hideToast()
      }, duration)
    },
    [hideToast, opacity, scale, translateX, translateY],
  )

  useEffect(() => {
    globalToast = showToast
    return () => {
      globalToast = null
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [showToast])

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onChange((e) => {
          "worklet"
          translateX.value = e.translationX
        })
        .onEnd((e) => {
          "worklet"
          if (Math.abs(e.translationX) > 100 || Math.abs(e.velocityX) > 500) {
            translateX.value = withTiming(
              Math.sign(e.translationX) * 400,
              { duration: 150 },
              (finished) => {
                "worklet"
                if (finished) {
                  scheduleOnRN(setVisible, false)
                }
              },
            )
          } else {
            translateX.value = withSpring(0, SPRING_CONFIG)
          }
        }),
    [translateX],
  )

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }))

  const contextValue = useMemo(() => ({ toast: showToast }), [showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {visible && (
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              styles.toastContainer,
              { top: insets.top + 8 },
              animatedStyle,
            ]}
          >
            <Pressable onPress={() => hideToast()}>
              <Card
                variant="default"
                className="flex-row items-center px-4 py-3"
                style={[
                  styles.toastCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getToastColor(toastType) + "1A" },
                  ]}
                >
                  {getToastIcon(toastType)}
                </View>
                <View style={styles.toastContent}>
                  <Text
                    style={[styles.toastText, { color: colors.foreground }]}
                    numberOfLines={2}
                  >
                    {message}
                  </Text>
                </View>
              </Card>
            </Pressable>
          </Animated.View>
        </GestureDetector>
      )}
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    alignSelf: "center",
    width: Dimensions.get("window").width - 32,
    maxWidth: 360,
    zIndex: 9999,
  },
  toastCard: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderRadius: 14,
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  toastContent: {
    flex: 1,
  },
  toastText: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
})
