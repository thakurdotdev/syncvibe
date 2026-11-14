import React, { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  Pressable,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';
import {
  project,
  rubberband,
  SHEET_CLOSE,
  SHEET_OPEN,
  SPRING_SHEET,
  SPRING_SNAP,
} from '@/lib/motion';

const DRAG_REGION_HEIGHT = 72;
/** A sheet can't be flicked further than this before it dismisses, however tall it is. */
const MAX_DISMISS_DISTANCE = 220;
/** Pulling a sheet up past its resting place barely moves it: nothing is underneath to show. */
const OVERDRAG_RESISTANCE = 0.15;

interface SwipeableModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: number | 'auto' | `${number}%`;
  hideHandle?: boolean;
  backdropOpacity?: number;
  style?: ViewStyle;
  scrollable?: boolean;
  useScrollView?: boolean;
  /** Shared scroll offset for FlatList/ScrollView content rendered by the caller. */
  scrollOffset?: SharedValue<number>;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  /** Present as an edge-to-edge modal screen instead of a rounded bottom sheet. */
  fullScreen?: boolean;
  /** Drag from anywhere on the sheet, not only its top edge. For sheets with nothing to scroll. */
  dragAnywhere?: boolean;
  /** False keeps it open against drags, the back button and backdrop taps. */
  dismissible?: boolean;
}

/**
 * Screens keep many closed sheets around, so a closed one holds no shared values, animated styles
 * or gestures. It opens each time `isVisible` turns true and stays closed until then, even if the
 * user dismissed it and the caller is still deciding what to do about that.
 */
/** Longer than any close animation; see `armCloseGuard`. */
const CLOSE_GUARD_MS = 900;
/** How long an open waits for the Modal's `onShow` before it goes ahead without it. */
const SHOW_FALLBACK_MS = 250;

const SwipeableModal: React.FC<SwipeableModalProps> = (props) => {
  const { isVisible } = props;
  const [mounted, setMounted] = useState(isVisible);
  const [wasVisible, setWasVisible] = useState(isVisible);

  if (isVisible !== wasVisible) {
    setWasVisible(isVisible);
    if (isVisible) setMounted(true);
  }

  const handleClosed = useCallback(() => setMounted(false), []);

  if (!mounted) return null;
  return <Sheet {...props} onClosed={handleClosed} />;
};

const Sheet: React.FC<SwipeableModalProps & { onClosed: () => void }> = ({
  isVisible,
  onClose,
  onClosed,
  children,
  maxHeight,
  hideHandle = false,
  backdropOpacity = 0.6,
  style,
  scrollable = false,
  useScrollView = false,
  scrollOffset,
  keyboardAvoiding = true,
  keyboardVerticalOffset = 0,
  fullScreen = false,
  dragAnywhere = false,
  dismissible = true,
}) => {
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0
  );
  const availableHeight = Math.max(0, windowHeight - topInset);

  const progress = useSharedValue(0);
  const gestureY = useSharedValue(0);
  const keyboardInset = useSharedValue(0);
  const internalScrollOffset = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const sheetTop = useSharedValue(0);
  // Off-screen whatever its real size, until the first layout says how far it has to travel.
  const sheetHeight = useSharedValue(windowHeight);
  const dragEligible = useSharedValue(false);
  const gestureActive = useSharedValue(false);
  const dragOrigin = useSharedValue(0);
  const closing = useSharedValue(0);
  const activeScrollOffset = scrollOffset ?? internalScrollOffset;
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const closeGuard = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The open waits for the sheet's real height and for the Modal window to be on screen.
  // Starting earlier, the travel distance changes mid-animation (a jump) and the first
  // frames play before anything is drawn: together they look like it opened twice.
  const measuredRef = useRef(false);
  const shownRef = useRef(false);
  const openPendingRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Android resizes a full-screen modal through the window insets. Applying
    // a second JS-managed inset there causes the blank area left after the
    // keyboard closes. iOS needs the frame value to animate its sheet safely.
    if (!keyboardAvoiding || !isVisible || Platform.OS !== 'ios') return;

    const updateKeyboardHeight = (event: { endCoordinates: { height: number } }) => {
      keyboardInset.set(withTiming(Math.max(0, event.endCoordinates.height), { duration: 220 }));
    };

    const showSubscription = Keyboard.addListener('keyboardWillChangeFrame', updateKeyboardHeight);
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => {
      keyboardInset.set(withTiming(0, { duration: 180 }));
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      keyboardInset.set(withTiming(0, SHEET_CLOSE));
    };
  }, [keyboardAvoiding, isVisible, keyboardInset]);

  const resolvedMaxHeight =
    typeof maxHeight === 'number'
      ? Math.min(maxHeight, availableHeight)
      : typeof maxHeight === 'string' && maxHeight.endsWith('%')
        ? (parseFloat(maxHeight) / 100) * availableHeight
        : availableHeight * 0.85;

  const hasExplicitHeight = fullScreen || StyleSheet.flatten(style)?.height != null;
  const finishClose = useCallback(() => {
    if (closeGuard.current) clearTimeout(closeGuard.current);
    closeGuard.current = null;
    closingRef.current = false;
    onClosed();
    onCloseRef.current();
  }, [onClosed]);

  /**
   * A close only finishes when its animation reports it finished. If anything interrupts that
   * animation, the sheet would stay mounted: invisible, but a full-screen Modal taking every
   * touch (and the back button). So a close that's still under way a moment later finishes
   * anyway, unless the sheet was opened again meanwhile.
   */
  const armCloseGuard = useCallback(() => {
    if (closeGuard.current) clearTimeout(closeGuard.current);
    closeGuard.current = setTimeout(() => {
      closeGuard.current = null;
      if (closing.get() === 1) finishClose();
    }, CLOSE_GUARD_MS);
  }, [closing, finishClose]);

  const animateOpen = useCallback(() => {
    if (closeGuard.current) clearTimeout(closeGuard.current);
    closeGuard.current = null;
    cancelAnimation(gestureY);
    closing.set(0);
    closingRef.current = false;
    gestureActive.set(false);
    gestureY.set(0);
    // Nothing carried momentum into a tap, so a curve: it moves from the first frame, where a
    // spring would still be picking up speed.
    progress.set(withTiming(1, SHEET_OPEN));
  }, [progress, gestureY, closing, gestureActive]);

  const openWhenReady = useCallback(() => {
    if (!openPendingRef.current || !measuredRef.current || !shownRef.current) return;
    openPendingRef.current = false;
    animateOpen();
  }, [animateOpen]);

  const animateClose = useCallback(() => {
    openPendingRef.current = false;
    if (closingRef.current || closing.get() === 1) return;

    closingRef.current = true;
    closing.set(1);
    progress.set(
      withTiming(0, SHEET_CLOSE, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(finishClose);
      })
    );
    gestureY.set(withTiming(0, SHEET_CLOSE));
    armCloseGuard();
  }, [progress, gestureY, closing, finishClose, armCloseGuard]);

  useEffect(
    () => () => {
      if (closeGuard.current) clearTimeout(closeGuard.current);
    },
    []
  );

  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sheetTop.set(event.nativeEvent.layout.y);
      sheetHeight.set(event.nativeEvent.layout.height);
      if (!measuredRef.current) {
        measuredRef.current = true;
        openWhenReady();
      }
    },
    [sheetTop, sheetHeight, openWhenReady]
  );

  const handleShow = useCallback(() => {
    shownRef.current = true;
    openWhenReady();
  }, [openWhenReady]);

  // If the platform never reports the Modal as shown, open anyway rather than stay hidden.
  useEffect(() => {
    const fallback = setTimeout(handleShow, SHOW_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [handleShow]);

  useEffect(() => {
    if (isVisible) {
      openPendingRef.current = true;
      openWhenReady();
      return;
    }
    animateClose();
  }, [isVisible, openWhenReady, animateClose]);

  const internalScrollHandler = useAnimatedScrollHandler((event) => {
    internalScrollOffset.set(event.contentOffset.y);
  });

  // Memoized: a new gesture on each render can drop a drag that's mid-flight.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissible)
        .manualActivation(true)
        .failOffsetX([-36, 36])
        .onTouchesDown((event) => {
          'worklet';
          const touch = event.allTouches[0];
          touchStartY.set(touch?.absoluteY ?? 0);
          dragEligible.set(
            !!touch && (dragAnywhere || touch.absoluteY <= sheetTop.get() + DRAG_REGION_HEIGHT)
          );
          gestureActive.set(false);
        })
        .onTouchesMove((event, stateManager) => {
          'worklet';
          if (!dragEligible.get()) {
            stateManager.fail();
            return;
          }

          const touch = event.allTouches[0];
          if (!touch) return;

          const translationY = touch.absoluteY - touchStartY.get();
          const isAtTop = activeScrollOffset.get() <= 1;

          // Let the list own upward scrolling and all drags that begin below its top.
          // The sheet can take over only for a downward pull from the top edge.
          if (!scrollable && translationY > 4) {
            stateManager.activate();
            gestureActive.set(true);
          } else if (scrollable && isAtTop && translationY > 4) {
            stateManager.activate();
            gestureActive.set(true);
          } else if (translationY < -4 || (scrollable && !isAtTop)) {
            stateManager.fail();
          }
        })
        .onTouchesUp((_, stateManager) => {
          'worklet';
          if (!gestureActive.get()) stateManager.fail();
        })
        .onStart((e) => {
          'worklet';
          // Grabbing it mid-settle continues from where it is on screen, with no jump.
          dragOrigin.set(gestureY.get() - e.translationY);
        })
        .onUpdate((e) => {
          'worklet';
          // Downward follows the finger exactly; upward past the resting place resists.
          const next = dragOrigin.get() + e.translationY;
          gestureY.set(next >= 0 ? next : rubberband(next, sheetHeight.get(), OVERDRAG_RESISTANCE));
        })
        .onEnd((e) => {
          'worklet';
          gestureActive.set(false);
          if (closing.get() === 1) return;

          // Where the flick was going decides, so a quick one is enough from any distance.
          const dismissAt = Math.min(sheetHeight.get() * 0.4, MAX_DISMISS_DISTANCE);
          if (gestureY.get() + project(e.velocityY) > dismissAt) {
            // Spring out carrying the flick's velocity (in progress units).
            closing.set(1);
            scheduleOnRN(armCloseGuard);
            progress.set(
              withSpring(
                0,
                {
                  ...SPRING_SHEET,
                  overshootClamping: true,
                  velocity: -e.velocityY / Math.max(sheetHeight.get(), 1),
                },
                (finished) => {
                  'worklet';
                  if (finished) scheduleOnRN(finishClose);
                }
              )
            );
          } else {
            // Clamped: an overshoot would lift the sheet off the bottom of the screen.
            gestureY.set(
              withSpring(0, { ...SPRING_SNAP, overshootClamping: true, velocity: e.velocityY })
            );
          }
        }),
    [
      activeScrollOffset,
      armCloseGuard,
      closing,
      dismissible,
      dragAnywhere,
      dragEligible,
      dragOrigin,
      finishClose,
      gestureActive,
      gestureY,
      progress,
      scrollable,
      sheetHeight,
      sheetTop,
      touchStartY,
    ]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(progress.get(), [0, 1], [0, backdropOpacity], Extrapolation.CLAMP) *
      interpolate(
        Math.max(gestureY.get(), 0),
        [0, sheetHeight.get()],
        [1, 0.35],
        Extrapolation.CLAMP
      ),
  }));

  // Travels its own height, not the window's: a short sheet is on screen from the first frame.
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.get()) * sheetHeight.get() + gestureY.get() }],
  }));

  const fixedKeyboardSheetStyle = useAnimatedStyle(() => {
    if (Platform.OS === 'ios' && hasExplicitHeight && keyboardInset.get() > 0.5) {
      return {
        height: Math.max(0, Math.min(resolvedMaxHeight, availableHeight - keyboardInset.get())),
      };
    }

    // Do not return `height: undefined`: because this style is applied after
    // the sheet style it clears an explicit full-screen height.
    return {};
  });

  return (
    <Modal
      visible={true}
      transparent
      animationType='none'
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={dismissible ? animateClose : undefined}
      onShow={handleShow}
    >
      <GestureHandlerRootView style={styles.root}>
        {fullScreen && (
          <StatusBar
            translucent
            backgroundColor={colors.card}
            barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
          />
        )}
        <KeyboardAvoidingView
          enabled={keyboardAvoiding && !hasExplicitHeight}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          style={styles.keyboardRoot}
        >
          <Pressable
            style={fullScreen ? styles.fullScreenBackdropTouchable : styles.backdropTouchable}
            onPress={dismissible ? animateClose : undefined}
          />

          <Animated.View style={[styles.backdrop, backdropStyle]} pointerEvents='none' />

          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.card,
                  ...(fullScreen
                    ? {
                        height: resolvedMaxHeight,
                        maxHeight: resolvedMaxHeight,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingBottom: 0,
                      }
                    : { maxHeight: resolvedMaxHeight }),
                },
                sheetStyle,
                style,
                fixedKeyboardSheetStyle,
              ]}
              onLayout={handleSheetLayout}
            >
              {!hideHandle && (
                <View style={styles.handleContainer}>
                  <View style={[styles.handle, { backgroundColor: colors.mutedForeground }]} />
                </View>
              )}
              {scrollable && useScrollView ? (
                <Animated.ScrollView
                  onScroll={internalScrollHandler}
                  scrollEventThrottle={16}
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps='handled'
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                  {children}
                </Animated.ScrollView>
              ) : (
                children
              )}
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouchable: {
    flex: 1,
  },
  fullScreenBackdropTouchable: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 4,
    borderRadius: 2,
  },
  scrollView: {
    width: '100%',
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
});

export default SwipeableModal;
