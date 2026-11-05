import { EASE_OUT, POP_FROM_SCALE, SPRING_PRESS } from '@/lib/motion';
import { AlertTriangle, Check } from 'lucide-react-native';
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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  ReduceMotion,
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

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  /** One button at the end of the toast. Pressing it also dismisses the toast. */
  action?: ToastAction;
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
  action?: ToastAction;
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
const DURATION_MS = 3000;
/** A toast with a button has to stay long enough to read it and reach for it. */
const ACTION_DURATION_MS = 5000;

const system = ReduceMotion.System;
const ENTER = { duration: 260, dampingRatio: 0.82, reduceMotion: system } as const;
const FADE_IN = { duration: 90, easing: EASE_OUT, reduceMotion: system } as const;
const LEAVE = { duration: 110, easing: EASE_OUT, reduceMotion: system } as const;
const REFLOW = LinearTransition.duration(160).easing(EASE_OUT);

const SWIPE_AWAY_DISTANCE = 44;
const SWIPE_AWAY_VELOCITY = 600;

interface ToastItemViewProps {
  item: ToastItem;
  colors: ThemeColors;
  onRemove: (id: string) => void;
}

/**
 * The inverse of the page, so it reads at a glance over anything, including artwork. It's as wide
 * as its words, and an icon only appears when it says something the words don't. Drops in, and
 * leaves faster than it came; tap it or flick it up or sideways to dismiss early.
 */
const ToastItemView = React.memo(({ item, colors, onRemove }: ToastItemViewProps) => {
  const opacity = useSharedValue(0);
  const y = useSharedValue(-18);
  const x = useSharedValue(0);
  const scale = useSharedValue(POP_FROM_SCALE);
  const leaving = useSharedValue(false);

  const finishRemove = useCallback(() => onRemove(item.id), [item.id, onRemove]);

  const dismiss = useCallback(() => {
    'worklet';
    if (leaving.get()) return;
    leaving.set(true);
    y.set(withTiming(y.get() - 8, LEAVE));
    scale.set(withTiming(POP_FROM_SCALE, LEAVE));
    opacity.set(
      withTiming(0, LEAVE, (finished) => {
        if (finished) scheduleOnRN(finishRemove);
      })
    );
  }, [finishRemove, leaving, opacity, scale, y]);

  useEffect(() => {
    opacity.set(withTiming(1, FADE_IN));
    y.set(withSpring(0, ENTER));
    scale.set(withSpring(1, ENTER));
  }, [opacity, scale, y]);

  useEffect(() => {
    const timeout = setTimeout(dismiss, item.duration);
    return () => clearTimeout(timeout);
  }, [dismiss, item.duration]);

  const pressAction = useCallback(() => {
    item.action?.onPress();
    dismiss();
  }, [dismiss, item.action]);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .activeOffsetY(-8)
        .onUpdate((e) => {
          if (leaving.get()) return;
          x.set(e.translationX);
          y.set(Math.min(0, e.translationY));
        })
        .onEnd((e, success) => {
          if (leaving.get()) return;
          const sideways = Math.abs(e.translationX) >= -e.translationY;
          const distance = sideways ? Math.abs(e.translationX) : -e.translationY;
          const speed = sideways ? Math.abs(e.velocityX) : -e.velocityY;
          if (success && (distance > SWIPE_AWAY_DISTANCE || speed > SWIPE_AWAY_VELOCITY)) {
            dismiss();
          } else {
            x.set(withSpring(0, SPRING_PRESS));
            y.set(withSpring(0, SPRING_PRESS));
          }
        }),
    [dismiss, leaving, x, y]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: y.get() }, { translateX: x.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        layout={REFLOW}
        accessibilityLiveRegion='polite'
        style={[styles.toast, { backgroundColor: colors.foreground }, animatedStyle]}
      >
        <Pressable onPress={() => dismiss()} accessibilityRole='alert' style={styles.body}>
          {item.type === 'success' ? (
            <Check size={16} color={colors.background} strokeWidth={2.6} />
          ) : item.type === 'error' ? (
            <AlertTriangle size={16} color={colors.destructive} strokeWidth={2.4} />
          ) : null}
          <Text style={[styles.message, { color: colors.background }]} numberOfLines={2}>
            {item.message}
          </Text>
        </Pressable>
        {item.action ? (
          <Pressable
            onPress={pressAction}
            hitSlop={6}
            accessibilityRole='button'
            accessibilityLabel={`${item.action.label}: ${item.message}`}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={[styles.actionText, { color: colors.background }]}>
              {item.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
});

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const type = options?.type ?? 'default';
    const action = options?.action;
    const duration = options?.duration ?? (action ? ACTION_DURATION_MS : DURATION_MS);
    const id = `toast-${Date.now()}-${nextId.current++}`;

    setToasts((current) => {
      // Repeated status messages should refresh one toast instead of stacking copies.
      const withoutDuplicate = current.filter(
        (item) => item.message !== message || item.type !== type
      );
      return [...withoutDuplicate, { id, message, type, duration, action }].slice(
        -MAX_VISIBLE_TOASTS
      );
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
          <ToastItemView key={item.id} item={item} colors={colors} onRemove={removeToast} />
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
    // Android layers by elevation too: above the player, which has to take its Undo taps.
    elevation: 50,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    maxWidth: 400,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  body: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  message: { flexShrink: 1, fontSize: 14, fontWeight: '600', lineHeight: 19, letterSpacing: -0.1 },
  action: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingLeft: 4,
    paddingRight: 14,
  },
  actionPressed: { opacity: 0.55 },
  actionText: { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
});
