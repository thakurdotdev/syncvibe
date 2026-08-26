import { AlertTriangle, Bell, Check, Info } from 'lucide-react-native';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeColors } from '@/theme/color';
import { useTheme } from './ThemeContext';

export type ToastType = 'default' | 'success' | 'error' | 'info';

interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

type ToastFunction = (message: string, options?: ToastOptions) => void;

let globalToast: ToastFunction | null = null;

export const toast = (message: string, options?: ToastOptions) => {
  if (globalToast) {
    globalToast(message, options);
  } else {
    console.warn('Toast not initialized yet. Make sure ToastProvider is mounted.');
  }
};

interface ToastContextType {
  toast: ToastFunction;
}

interface ToastProviderProps {
  children: ReactNode;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const MAX_VISIBLE_TOASTS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ENTER_SPRING = { damping: 28, stiffness: 340, mass: 0.7 };

const getToastIcon = (type: ToastType, color: string) => {
  const iconProps = { size: 17, color, strokeWidth: 2.2 };

  switch (type) {
    case 'success':
      return <Check {...iconProps} />;
    case 'error':
      return <AlertTriangle {...iconProps} />;
    case 'info':
      return <Info {...iconProps} />;
    default:
      return <Bell {...iconProps} />;
  }
};

interface ToastItemViewProps {
  item: ToastItem;
  colors: ThemeColors;
  accentColor: string;
  onRemove: (id: string) => void;
}

const ToastItemView = React.memo(({ item, colors, accentColor, onRemove }: ToastItemViewProps) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-8);
  const translateX = useSharedValue(0);
  const dismissed = useSharedValue(0);
  const removedRef = useRef(false);

  const finishRemove = useCallback(() => {
    if (removedRef.current) return;
    removedRef.current = true;
    onRemove(item.id);
  }, [item.id, onRemove]);

  const animateOut = useCallback(() => {
    if (removedRef.current || dismissed.value === 1) return;

    dismissed.value = 1;
    cancelAnimation(opacity);
    cancelAnimation(translateY);
    opacity.value = withTiming(0, { duration: 140 }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(finishRemove);
    });
    translateY.value = withTiming(-6, { duration: 140 });
  }, [dismissed, finishRemove, opacity, translateY]);

  useEffect(() => {
    dismissed.value = 0;
    removedRef.current = false;
    opacity.value = 0;
    translateY.value = -8;
    translateX.value = 0;
    opacity.value = withTiming(1, { duration: 140 });
    translateY.value = withSpring(0, ENTER_SPRING);
  }, [dismissed, opacity, translateX, translateY]);

  useEffect(() => {
    const timeout = setTimeout(animateOut, item.duration);
    return () => clearTimeout(timeout);
  }, [animateOut, item.duration]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .onChange((event) => {
          'worklet';
          if (dismissed.value === 0) translateX.value = event.translationX;
        })
        .onEnd((event) => {
          'worklet';
          if (dismissed.value === 1) return;

          if (Math.abs(event.translationX) > 90 || Math.abs(event.velocityX) > 500) {
            dismissed.value = 1;
            const direction = event.translationX >= 0 ? 1 : -1;
            translateX.value = withTiming(
              direction * SCREEN_WIDTH,
              { duration: 150 },
              (finished) => {
                'worklet';
                if (finished) scheduleOnRN(finishRemove);
              }
            );
            opacity.value = withTiming(0, { duration: 120 });
          } else {
            translateX.value = withSpring(0, ENTER_SPRING);
          }
        }),
    [dismissed, finishRemove, opacity, translateX]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        layout={LinearTransition.duration(160)}
        style={[styles.toastContainer, animatedStyle]}
      >
        <Pressable
          accessibilityRole='button'
          accessibilityLabel={item.message}
          onPress={animateOut}
        >
          <View
            style={[
              styles.toastSurface,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.iconContainer}>{getToastIcon(item.type, accentColor)}</View>
            <Text style={[styles.toastText, { color: colors.foreground }]} numberOfLines={2}>
              {item.message}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
});

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const getToastColor = useCallback(
    (type: ToastType) => {
      switch (type) {
        case 'success':
          return colors.primary;
        case 'error':
          return colors.destructive;
        case 'info':
          return colors.accent;
        default:
          return colors.mutedForeground;
      }
    },
    [colors]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const type = options?.type ?? 'default';
    const duration = options?.duration ?? 3000;
    const id = `toast-${Date.now()}-${nextId.current++}`;

    setToasts((current) => {
      // Repeated status messages should refresh one toast instead of stacking copies.
      const withoutDuplicate = current.filter(
        (item) => item.message !== message || item.type !== type
      );
      return [...withoutDuplicate, { id, message, type, duration }].slice(-MAX_VISIBLE_TOASTS);
    });
  }, []);

  useEffect(() => {
    globalToast = showToast;
    return () => {
      globalToast = null;
    };
  }, [showToast]);

  const contextValue = useMemo(() => ({ toast: showToast }), [showToast]);
  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS).reverse();

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View pointerEvents='box-none' style={[styles.toastLayer, { top: insets.top + 10 }]}>
        {visibleToasts.map((item) => (
          <ToastItemView
            key={item.id}
            item={item}
            colors={colors}
            accentColor={getToastColor(item.type)}
            onRemove={removeToast}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastLayer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
  },
  toastContainer: {
    width: '100%',
    maxWidth: 380,
  },
  toastSurface: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  iconContainer: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});
