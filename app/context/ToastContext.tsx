import PressableScale from '@/components/ui/PressableScale';
import {
  BUTTON_PRESS_SCALE,
  EXIT,
  project,
  rubberband,
  SHEET_OPEN,
  SPRING_SHEET,
  SPRING_SNAP,
  ENTER,
} from '@/lib/motion';
import { CircleAlert, CircleCheck, Info } from 'lucide-react-native';
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
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
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
  /** Going away: no longer counted in the stack, and removed once its exit has played. */
  leaving: boolean;
  /** Changes when the same message comes in again, which restarts its timer. */
  refreshes: number;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/** Shown at once; the next ones wait behind and come forward as these go. */
const MAX_VISIBLE_TOASTS = 3;
const MAX_QUEUED_TOASTS = 6;
const DURATION_MS = 4000;
/** A toast with a button has to stay long enough to read it and reach for it. */
const ACTION_DURATION_MS = 6000;
/** An open stack has no outside to tap on (touches there belong to the page), so it closes itself. */
const EXPANDED_MS = 4000;

const MAX_WIDTH = 400;
const SIDE_MARGIN = 16;
/** How much of each older toast shows below the one in front. */
const PEEK = 10;
const SCALE_STEP = 0.05;
const EXPANDED_GAP = 8;
const FALLBACK_HEIGHT = 52;
/** How far a flick has to be heading to dismiss. */
const SWIPE_AWAY_DISTANCE = 56;

interface CardPlacement {
  index: number;
  y: number;
  scale: number;
  backgroundHeight: number;
  /** Words only show on the front toast, unless the stack is open. */
  showContent: boolean;
  interactive: boolean;
}

interface ToastCardProps {
  item: ToastItem;
  placement: CardPlacement;
  width: number;
  /** How far it has to come from to start fully off screen. */
  topInset: number;
  paused: boolean;
  colors: ThemeColors;
  onMeasure: (id: string, height: number) => void;
  onPress: (id: string) => void;
  onDismiss: (id: string) => void;
  onRemove: (id: string) => void;
  onDragChange: (dragging: boolean) => void;
}

const TypeIcon = ({ type, colors }: { type: ToastType; colors: ThemeColors }) => {
  if (type === 'success') return <CircleCheck size={18} color={colors.foreground} />;
  if (type === 'error') return <CircleAlert size={18} color={colors.destructive} />;
  if (type === 'info') return <Info size={18} color={colors.mutedForeground} />;
  return null;
};

/**
 * One toast. Everything moves on the UI thread with transforms and opacity. The surface is a
 * separate empty layer, because in a closed stack every card takes the front one's height: being
 * absolutely positioned with no children, animating its height costs no layout for anything else.
 */
const ToastCard = React.memo(function ToastCard({
  item,
  placement,
  width,
  topInset,
  paused,
  colors,
  onMeasure,
  onPress,
  onDismiss,
  onRemove,
  onDragChange,
}: ToastCardProps) {
  const { id, leaving, duration, refreshes, action } = item;
  const [height, setHeight] = useState(0);

  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const backgroundHeight = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const swiped = useSharedValue(false);

  const entered = useRef(false);
  // A leaving toast keeps its layer, so an older one fading out doesn't flash over the front one.
  const layer = useRef(placement.index);
  if (!leaving) layer.current = placement.index;
  const { y: targetY, scale: targetScale, backgroundHeight: targetBackground } = placement;
  const hidden = placement.index >= MAX_VISIBLE_TOASTS;
  const { showContent } = placement;

  // Where the stack wants this card. Enters from above the screen; afterwards just moves there.
  useEffect(() => {
    if (!height || leaving) return;
    if (!entered.current) {
      entered.current = true;
      scale.set(targetScale);
      backgroundHeight.set(targetBackground);
      contentOpacity.set(showContent ? 1 : 0);
      y.set(-(height + topInset + 16));
      y.set(withTiming(targetY, SHEET_OPEN));
      opacity.set(withTiming(hidden ? 0 : 1, ENTER));
      return;
    }
    y.set(withTiming(targetY, SHEET_OPEN));
    scale.set(withTiming(targetScale, SHEET_OPEN));
    backgroundHeight.set(withTiming(targetBackground, SHEET_OPEN));
    opacity.set(withTiming(hidden ? 0 : 1, ENTER));
    contentOpacity.set(withTiming(showContent ? 1 : 0, ENTER));
  }, [
    backgroundHeight,
    contentOpacity,
    height,
    hidden,
    leaving,
    opacity,
    scale,
    showContent,
    targetBackground,
    targetScale,
    targetY,
    topInset,
    y,
  ]);

  // Leaving by timer or tap: lifts away, quicker than it came. A swipe has already sent it off.
  useEffect(() => {
    if (!leaving || swiped.get()) return;
    y.set(withTiming(y.get() - 16, EXIT));
    opacity.set(
      withTiming(0, EXIT, (finished) => {
        if (finished) scheduleOnRN(onRemove, id);
      })
    );
  }, [id, leaving, onRemove, opacity, swiped, y]);

  // Time left survives a pause, and the same message arriving again starts it over.
  const remaining = useRef(duration);
  useEffect(() => {
    remaining.current = duration;
  }, [duration, refreshes]);
  useEffect(() => {
    if (paused || leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(500, remaining.current - (Date.now() - startedAt));
    };
  }, [id, leaving, onDismiss, paused, refreshes]);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .enabled(placement.interactive)
        .activeOffsetX([-8, 8])
        .activeOffsetY([-8, 8])
        .onStart(() => {
          scheduleOnRN(onDragChange, true);
        })
        .onUpdate((e) => {
          dragX.set(e.translationX);
          // Up is the way out, so it follows the finger. Down has nowhere to go, so it resists.
          dragY.set(e.translationY <= 0 ? e.translationY : rubberband(e.translationY, 200));
        })
        .onEnd((e, success) => {
          const sideways = Math.abs(e.translationX) >= Math.abs(e.translationY);
          const heading = sideways
            ? Math.abs(e.translationX + project(e.velocityX))
            : -(e.translationY + project(e.velocityY));

          if (success && heading > SWIPE_AWAY_DISTANCE) {
            swiped.set(true);
            scheduleOnRN(onDismiss, id);
            const done = (finished?: boolean) => {
              'worklet';
              if (finished) scheduleOnRN(onRemove, id);
            };
            const off = { ...SPRING_SHEET, overshootClamping: true };
            if (sideways) {
              const side = e.translationX + e.velocityX >= 0 ? 1 : -1;
              dragX.set(withSpring(side * (width + 32), { ...off, velocity: e.velocityX }, done));
            } else {
              dragY.set(withSpring(-(topInset + 200), { ...off, velocity: e.velocityY }, done));
            }
          } else {
            dragX.set(withSpring(0, { ...SPRING_SNAP, velocity: e.velocityX }));
            dragY.set(withSpring(0, { ...SPRING_SNAP, velocity: e.velocityY }));
          }
        })
        .onFinalize(() => {
          scheduleOnRN(onDragChange, false);
        }),
    [
      dragX,
      dragY,
      id,
      onDismiss,
      onDragChange,
      onRemove,
      placement.interactive,
      swiped,
      topInset,
      width,
    ]
  );

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.get() * Math.max(0, 1 - Math.abs(dragX.get()) / width),
    transform: [
      { translateX: dragX.get() },
      { translateY: y.get() + dragY.get() },
      { scale: scale.get() },
    ],
  }));
  const backgroundStyle = useAnimatedStyle(() => ({ height: backgroundHeight.get() }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.get() }));

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View
        pointerEvents={leaving || hidden ? 'none' : 'auto'}
        accessibilityLiveRegion='polite'
        style={[styles.card, { width, zIndex: 100 - layer.current }, cardStyle]}
      >
        <Animated.View
          style={[
            styles.background,
            { backgroundColor: colors.card, borderColor: colors.border },
            backgroundStyle,
          ]}
        />
        <Animated.View
          style={[styles.content, contentStyle]}
          pointerEvents={showContent ? 'auto' : 'none'}
          onLayout={(e) => {
            const measured = e.nativeEvent.layout.height;
            setHeight(measured);
            onMeasure(id, measured);
          }}
        >
          <View style={styles.row}>
            <Pressable onPress={() => onPress(id)} accessibilityRole='alert' style={styles.body}>
              <TypeIcon type={item.type} colors={colors} />
              <Text style={[styles.message, { color: colors.foreground }]} numberOfLines={2}>
                {item.message}
              </Text>
            </Pressable>
            {action ? (
              <PressableScale
                onPress={() => {
                  action.onPress();
                  onDismiss(id);
                }}
                scaleTo={BUTTON_PRESS_SCALE}
                hitSlop={8}
                accessibilityRole='button'
                accessibilityLabel={`${action.label}: ${item.message}`}
                style={[styles.action, { backgroundColor: colors.foreground }]}
              >
                <Text style={[styles.actionText, { color: colors.background }]}>
                  {action.label}
                </Text>
              </PressableScale>
            ) : null}
          </View>
        </Animated.View>
        {/* A closed older card has no words to tap, but its edge can still open the stack. */}
        {showContent ? null : (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onPress(id)} />
        )}
      </Animated.View>
    </GestureDetector>
  );
});

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    setHeights(({ [id]: _gone, ...rest }) => rest);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) =>
      current.map((item) => (item.id === id ? { ...item, leaving: true } : item))
    );
  }, []);

  const measureToast = useCallback((id: string, height: number) => {
    setHeights((current) => (current[id] === height ? current : { ...current, [id]: height }));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    const type = options?.type ?? 'default';
    const action = options?.action;
    const duration = options?.duration ?? (action ? ACTION_DURATION_MS : DURATION_MS);

    setToasts((current) => {
      // The same message again brings the one already showing forward, with its time reset.
      const repeat = current.find(
        (item) => !item.leaving && item.message === message && item.type === type
      );
      if (repeat) {
        return [
          ...current.filter((item) => item !== repeat),
          { ...repeat, action, duration, refreshes: repeat.refreshes + 1 },
        ];
      }
      const added = [
        ...current,
        {
          id: `toast-${Date.now()}-${nextId.current++}`,
          message,
          type,
          duration,
          action,
          leaving: false,
          refreshes: 0,
        },
      ];
      const live = added.filter((item) => !item.leaving);
      if (live.length <= MAX_QUEUED_TOASTS) return added;
      return added.map((item) => (item === live[0] ? { ...item, leaving: true } : item));
    });
  }, []);

  useEffect(() => {
    globalToast = showToast;
    return () => {
      globalToast = null;
    };
  }, [showToast]);

  /** Newest first: index 0 is the one in front. */
  const live = useMemo(() => toasts.filter((item) => !item.leaving).reverse(), [toasts]);
  const stackable = live.length > 1;

  // Nothing left to spread out, or left open long enough.
  useEffect(() => {
    if (!expanded) return;
    if (!stackable) {
      setExpanded(false);
      return;
    }
    if (dragging) return;
    const timer = setTimeout(() => setExpanded(false), EXPANDED_MS);
    return () => clearTimeout(timer);
  }, [dragging, expanded, stackable, toasts]);

  const pressToast = useCallback(
    (id: string) => {
      // Tapping a closed stack opens it to read; tapping a toast on its own dismisses it.
      if (stackable && !expanded) setExpanded(true);
      else dismissToast(id);
    },
    [dismissToast, expanded, stackable]
  );

  const frontHeight = heights[live[0]?.id] || FALLBACK_HEIGHT;
  const placements = useMemo(() => {
    const result: Record<string, CardPlacement> = {};
    let below = 0;
    live.forEach((item, index) => {
      const own = heights[item.id] || FALLBACK_HEIGHT;
      const depth = Math.min(index, MAX_VISIBLE_TOASTS - 1);
      const scale = 1 - depth * SCALE_STEP;
      result[item.id] = expanded
        ? {
            index,
            y: below,
            scale: 1,
            backgroundHeight: own,
            showContent: true,
            interactive: true,
          }
        : {
            index,
            // Scaled from its top edge, so its bottom ends up exactly PEEK below the one in front.
            y: index === 0 ? 0 : frontHeight + depth * PEEK - frontHeight * scale,
            scale,
            backgroundHeight: frontHeight,
            showContent: index === 0,
            interactive: index === 0,
          };
      below += own + EXPANDED_GAP;
    });
    return result;
  }, [expanded, frontHeight, heights, live]);

  const contextValue = useMemo(() => ({ toast: showToast }), [showToast]);
  const width = Math.min(windowWidth - SIDE_MARGIN * 2, MAX_WIDTH);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <View pointerEvents='box-none' style={[styles.layer, { top: insets.top + 10 }]}>
        {toasts.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            // A leaving toast stays where it was while the others close the gap.
            placement={
              placements[item.id] ?? {
                index: 0,
                y: 0,
                scale: 1,
                backgroundHeight: heights[item.id] || FALLBACK_HEIGHT,
                showContent: true,
                interactive: false,
              }
            }
            width={width}
            topInset={insets.top}
            paused={expanded || dragging}
            colors={colors}
            onMeasure={measureToast}
            onPress={pressToast}
            onDismiss={dismissToast}
            onRemove={removeToast}
            onDragChange={setDragging}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  // Fills the screen below the status bar so toasts can be touched anywhere they spread to.
  // box-none lets every other touch through to the page.
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 9999,
    // Android layers by elevation too: above the player, which has to take its Undo taps.
    elevation: 50,
  },
  card: { position: 'absolute', top: 0, transformOrigin: 'top' },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  // Android draws by elevation before order, and the surface has to have some for its shadow. With
  // no background this casts no shadow of its own; it just stays above the surface.
  content: { elevation: 7 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: FALLBACK_HEIGHT },
  body: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
  },
  message: { flexShrink: 1, fontSize: 14, fontWeight: '600', lineHeight: 19, letterSpacing: -0.1 },
  action: {
    height: 30,
    paddingHorizontal: 12,
    marginRight: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
});
